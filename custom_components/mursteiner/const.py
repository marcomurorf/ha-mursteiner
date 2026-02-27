"""Mursteiner Dashboard — HA Integration für Uhr + Busabfahrten."""

DOMAIN = "mursteiner"
PLATFORMS = ["sensor"]

CONF_STOP = "stop"
CONF_DIRECTION = "direction"
CONF_LINE = "line"
CONF_LIMIT = "limit"
CONF_SCAN_INTERVAL = "scan_interval"

DEFAULT_STOP = "Klagenfurt Kriemhildgasse"
DEFAULT_DIRECTION = "Klagenfurt Heiligengeistplatz"
DEFAULT_LINE = "Bus 5"
DEFAULT_LIMIT = 5
DEFAULT_SCAN_INTERVAL = 60

OEBB_HAFAS_BASE = "https://fahrplan.oebb.at/bin/stboard.exe/dn"
