"""Mursteiner Bus Integration."""
from __future__ import annotations

import logging
import os
import shutil

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)

CARD_FILENAME = "mursteiner-bus-card.js"
CARD_URL = f"/local/{CARD_FILENAME}"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Mursteiner from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # Frontend-Card in www/ kopieren + als Lovelace-Ressource registrieren
    await hass.async_add_executor_job(_copy_card_to_www, hass)
    await _register_lovelace_resource(hass)

    # Plattformen laden
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok


def _copy_card_to_www(hass: HomeAssistant) -> None:
    """Copy card JS to /config/www/ so it's served via /local/."""
    src = os.path.join(os.path.dirname(__file__), "cards", CARD_FILENAME)
    www_dir = hass.config.path("www")
    dst = os.path.join(www_dir, CARD_FILENAME)

    # www-Ordner erstellen falls nicht vorhanden
    os.makedirs(www_dir, exist_ok=True)

    # Immer kopieren (Update sicherstellen)
    shutil.copy2(src, dst)
    _LOGGER.info("Card kopiert nach: %s", dst)


async def _register_lovelace_resource(hass: HomeAssistant) -> None:
    """Register as Lovelace resource if not already present."""
    if hass.data.get(f"{DOMAIN}_resource_registered"):
        return
    hass.data[f"{DOMAIN}_resource_registered"] = True

    try:
        from homeassistant.components.lovelace.resources import (
            ResourceStorageCollection,
        )
        resources: ResourceStorageCollection = hass.data["lovelace"]["resources"]
        existing = [
            r for r in resources.async_items()
            if CARD_FILENAME in r.get("url", "")
        ]
        if not existing:
            await resources.async_create_item(
                {"res_type": "module", "url": CARD_URL}
            )
            _LOGGER.info("Lovelace-Ressource registriert: %s", CARD_URL)
        else:
            _LOGGER.debug("Lovelace-Ressource bereits vorhanden")
    except Exception as err:
        _LOGGER.warning(
            "Lovelace-Ressource konnte nicht automatisch registriert werden: %s. "
            "Bitte manuell hinzufügen: Einstellungen → Dashboards → Ressourcen → "
            "%s (JavaScript-Modul)", err, CARD_URL
        )
