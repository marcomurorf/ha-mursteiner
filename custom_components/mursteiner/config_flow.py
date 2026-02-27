"""Config flow for Mursteiner Dashboard."""
from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback

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
)


class MursteinerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config flow for Mursteiner."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            # Titel für den Config Entry
            line = user_input.get(CONF_LINE, "").strip()
            stop = user_input.get(CONF_STOP, DEFAULT_STOP)
            title = f"{line} — {stop}" if line else stop

            return self.async_create_entry(title=title, data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_STOP, default=DEFAULT_STOP): str,
                    vol.Required(CONF_DIRECTION, default=DEFAULT_DIRECTION): str,
                    vol.Optional(CONF_LINE, default=DEFAULT_LINE): str,
                    vol.Optional(CONF_LIMIT, default=DEFAULT_LIMIT): vol.All(
                        int, vol.Range(min=1, max=20)
                    ),
                    vol.Optional(
                        CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL
                    ): vol.All(int, vol.Range(min=15, max=600)),
                }
            ),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow."""
        return MursteinerOptionsFlow(config_entry)


class MursteinerOptionsFlow(config_entries.OptionsFlow):
    """Options flow for Mursteiner."""

    def __init__(self, config_entry):
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        data = self.config_entry.data

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_STOP, default=data.get(CONF_STOP, DEFAULT_STOP)
                    ): str,
                    vol.Required(
                        CONF_DIRECTION,
                        default=data.get(CONF_DIRECTION, DEFAULT_DIRECTION),
                    ): str,
                    vol.Required(
                        CONF_LINE, default=data.get(CONF_LINE, DEFAULT_LINE)
                    ): str,
                    vol.Optional(
                        CONF_LIMIT, default=data.get(CONF_LIMIT, DEFAULT_LIMIT)
                    ): vol.All(int, vol.Range(min=1, max=20)),
                    vol.Optional(
                        CONF_SCAN_INTERVAL,
                        default=data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
                    ): vol.All(int, vol.Range(min=15, max=600)),
                }
            ),
        )
