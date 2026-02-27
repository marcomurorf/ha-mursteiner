"""Mursteiner Bus Integration."""
from __future__ import annotations

import logging
import os

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Mursteiner from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # Frontend-Card registrieren
    await _register_cards(hass)

    # Plattformen laden
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok


async def _register_cards(hass: HomeAssistant) -> None:
    """Register custom Lovelace cards."""
    # Nur einmal registrieren
    if hass.data.get(f"{DOMAIN}_cards_registered"):
        return
    hass.data[f"{DOMAIN}_cards_registered"] = True

    # Pfad zu den JS-Dateien
    cards_dir = os.path.join(os.path.dirname(__file__), "cards")

    hass.http.register_static_path(
        f"/mursteiner/mursteiner-bus-card.js",
        os.path.join(cards_dir, "mursteiner-bus-card.js"),
        cache_headers=False,
    )

    # Lovelace-Ressource automatisch registrieren
    from homeassistant.components.lovelace.resources import (
        ResourceStorageCollection,
    )

    try:
        resources: ResourceStorageCollection = hass.data["lovelace"]["resources"]
        # Prüfen ob schon registriert
        existing = [r for r in resources.async_items() if "mursteiner-bus" in r.get("url", "")]
        if not existing:
            await resources.async_create_item(
                {"res_type": "module", "url": "/mursteiner/mursteiner-bus-card.js"}
            )
            _LOGGER.info("Mursteiner Bus Lovelace card registered")
    except Exception:
        _LOGGER.warning(
            "Konnte Lovelace-Ressource nicht automatisch registrieren. "
            "Bitte manuell hinzufügen: /mursteiner/mursteiner-bus-card.js"
        )
