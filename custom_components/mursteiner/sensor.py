"""Sensor platform for Mursteiner Bus departures."""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import timedelta
from html import unescape
from urllib.parse import urlencode

import aiohttp

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.device_registry import DeviceEntryType
from homeassistant.helpers.entity import DeviceInfo
import homeassistant.util.dt as dt_util

from .const import (
    DOMAIN,
    CONF_STOP,
    CONF_DIRECTION,
    CONF_LINE,
    CONF_LIMIT,
    CONF_SCAN_INTERVAL,
    DEFAULT_STOP,
    DEFAULT_DIRECTION,
    DEFAULT_LINE,
    DEFAULT_LIMIT,
    DEFAULT_SCAN_INTERVAL,
    OEBB_HAFAS_BASE,
)

_LOGGER = logging.getLogger(__name__)

# HTML-Entity-Ersetzungen
HTML_ENTITIES = {
    "&#228;": "ä", "&#246;": "ö", "&#252;": "ü",
    "&#196;": "Ä", "&#214;": "Ö", "&#220;": "Ü",
    "&#223;": "ß",
}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the bus departure sensor."""
    data = entry.data

    sensor = MursteinerBusSensor(
        hass=hass,
        entry_id=entry.entry_id,
        stop=data.get(CONF_STOP, DEFAULT_STOP),
        direction=data.get(CONF_DIRECTION, DEFAULT_DIRECTION),
        line=data.get(CONF_LINE, DEFAULT_LINE),
        limit=data.get(CONF_LIMIT, DEFAULT_LIMIT),
        scan_interval=data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
    )
    async_add_entities([sensor], update_before_add=True)


class MursteinerBusSensor(SensorEntity):
    """Sensor that provides next bus departures."""

    _attr_icon = "mdi:bus-clock"
    _attr_has_entity_name = True

    def __init__(
        self,
        hass: HomeAssistant,
        entry_id: str,
        stop: str,
        direction: str,
        line: str,
        limit: int,
        scan_interval: int,
    ) -> None:
        """Initialize the sensor."""
        self.hass = hass
        self._entry_id = entry_id
        self._stop = stop
        self._direction = direction
        self._line = line
        self._limit = limit
        self._scan_interval = timedelta(seconds=scan_interval)
        self._journeys: list[dict] = []
        self._station_name = stop

        # Entity-IDs
        line_slug = line.lower().replace(" ", "_")
        stop_slug = re.sub(r"[^a-z0-9]+", "_", stop.lower()).strip("_")
        self._attr_unique_id = f"mursteiner_bus_{stop_slug}_{line_slug}"
        self._attr_name = f"{line} {stop.split(' ', 1)[-1] if ' ' in stop else stop}"

        # Device info for proper HA integration
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry_id)},
            name=f"Mursteiner Bus {stop.split(' ', 1)[-1] if ' ' in stop else stop}",
            manufacturer="ÖBB HAFAS",
            model="Bus Abfahrten",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self) -> str | None:
        """Return the next departure time as state."""
        if self._journeys:
            j = self._journeys[0]
            time = j.get("ti", "")
            # Echtzeit verwenden wenn vorhanden
            if isinstance(j.get("rt"), dict) and j["rt"].get("dlt"):
                time = j["rt"]["dlt"]
            return time
        return None

    @property
    def extra_state_attributes(self) -> dict:
        """Return departure details as attributes."""
        attrs = {
            "station": self._station_name,
            "direction": self._direction,
            "line": self._line,
            "departures": [],
        }

        now = dt_util.now()

        for j in self._journeys:
            dep_time = j.get("ti", "")
            dep_date = j.get("da", "")
            delay = 0
            real_time = dep_time

            # Echtzeit-Daten
            rt = j.get("rt")
            if isinstance(rt, dict):
                delay = int(rt.get("dlm", 0) or 0)
                if rt.get("dlt"):
                    real_time = rt["dlt"]
                if rt.get("dld"):
                    dep_date = rt["dld"]

            # Countdown berechnen
            minutes_until = self._calc_minutes(dep_date, real_time, now)

            attrs["departures"].append({
                "scheduled": dep_time,
                "realtime": real_time,
                "date": dep_date,
                "line": j.get("pr", self._line),
                "destination": j.get("st", ""),
                "delay_minutes": delay,
                "minutes_until": minutes_until,
            })

        # Nächster Bus in Minuten als Top-Level-Attribut
        if attrs["departures"]:
            attrs["next_in_minutes"] = attrs["departures"][0].get("minutes_until")
            attrs["next_realtime"] = attrs["departures"][0].get("realtime")
            attrs["next_delay"] = attrs["departures"][0].get("delay_minutes", 0)

        return attrs

    @staticmethod
    def _calc_minutes(date_str: str, time_str: str, now) -> int | None:
        """Calculate minutes until departure."""
        try:
            parts = date_str.split(".")
            tp = time_str.split(":")
            if len(parts) < 3 or len(tp) < 2:
                return None
            from datetime import datetime

            dep = datetime(
                int(parts[2]), int(parts[1]), int(parts[0]),
                int(tp[0]), int(tp[1]), 0,
                tzinfo=now.tzinfo,
            )
            diff = (dep - now).total_seconds()
            return max(0, int(diff // 60))
        except (ValueError, IndexError):
            return None

    async def async_update(self) -> None:
        """Fetch departure data from ÖBB HAFAS."""
        try:
            session = async_get_clientsession(self.hass)
            params = {
                "input": self._stop,
                "boardType": "dep",
                "dirInput": self._direction,
                "maxJourneys": self._limit,
                "start": "yes",
                "outputMode": "tickerDataOnly",
                "L": "vs_scotty.vs_liveticker",
            }
            url = f"{OEBB_HAFAS_BASE}?{urlencode(params)}"
            _LOGGER.debug("Fetching departures from: %s", url)

            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=15),
                headers={"User-Agent": "HomeAssistant/MursteinerBus/1.0"},
            ) as resp:
                raw_bytes = await resp.read()
                raw = raw_bytes.decode("iso-8859-1")

            _LOGGER.debug("API response length: %d", len(raw))
            data = self._parse_response(raw)

            if data:
                self._station_name = data.get("stationName", self._stop)
                journeys = data.get("journey", [])
                _LOGGER.debug("Got %d journeys from API", len(journeys))

                # Nach Linie filtern
                if self._line:
                    journeys = [
                        j for j in journeys
                        if j.get("pr", "").lower() == self._line.lower()
                    ]
                    _LOGGER.debug("After line filter (%s): %d journeys", self._line, len(journeys))

                self._journeys = journeys
            else:
                _LOGGER.warning("Keine Abfahrtsdaten erhalten für %s", self._stop)

        except asyncio.TimeoutError:
            _LOGGER.warning("Timeout bei Abfrage der Abfahrtsdaten für %s", self._stop)
        except Exception as err:
            _LOGGER.error("Fehler bei Abfrage der Abfahrtsdaten: %s", err)

    @staticmethod
    def _parse_response(raw: str) -> dict | None:
        """Parse the HAFAS JavaScript response into a dict."""
        import json

        match = re.search(r"journeysObj\s*=\s*(\{.*\})", raw, re.DOTALL)
        if not match:
            return None

        json_str = match.group(1)
        # HTML-Entities dekodieren
        for entity, char in HTML_ENTITIES.items():
            json_str = json_str.replace(entity, char)

        try:
            return json.loads(json_str)
        except json.JSONDecodeError as err:
            _LOGGER.error("JSON-Parsing fehlgeschlagen: %s", err)
            return None

    @property
    def update_interval(self) -> timedelta:
        """Return the polling interval."""
        return self._scan_interval

    async def async_added_to_hass(self) -> None:
        """Schedule regular updates."""
        from homeassistant.helpers.event import async_track_time_interval

        self._unsub_interval = async_track_time_interval(
            self.hass, self._async_scheduled_update, self._scan_interval
        )

    async def _async_scheduled_update(self, _now=None) -> None:
        """Handle scheduled update."""
        await self.async_update()
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        """Cleanup on removal."""
        if hasattr(self, "_unsub_interval") and self._unsub_interval:
            self._unsub_interval()
