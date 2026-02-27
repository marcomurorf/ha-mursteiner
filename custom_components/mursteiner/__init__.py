"""Mursteiner Bus Integration."""
from __future__ import annotations

import logging
import os

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig

from .const import DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/mursteiner/mursteiner-bus-card.js"


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
    """Register custom Lovelace card as extra JS module."""
    if hass.data.get(f"{DOMAIN}_cards_registered"):
        return
    hass.data[f"{DOMAIN}_cards_registered"] = True

    cards_dir = os.path.join(os.path.dirname(__file__), "cards")
    card_path = os.path.join(cards_dir, "mursteiner-bus-card.js")

    _LOGGER.info("Registering bus card from: %s", card_path)

    # Statischen Pfad registrieren (neue API)
    await hass.http.async_register_static_paths([
        StaticPathConfig(CARD_URL, card_path, False)
    ])

    # Als Extra-JS dem Frontend hinzufügen
    add_extra_js_url(hass, CARD_URL, es5=False)

    _LOGGER.info("Mursteiner Bus card registered at %s", CARD_URL)
