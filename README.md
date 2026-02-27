# Mursteiner Bus — Home Assistant Integration

HA-Integration für **Bus-Abfahrten** (Stadtwerke Klagenfurt / KMG via ÖBB HAFAS).

## Features

- **Mursteiner Bus Card** — Nächste Busabfahrten mit Minuten-Countdown und Echtzeit-Verspätung  
- **HA Sensor** — Pollt Abfahrtsdaten direkt von der ÖBB HAFAS API, kein externer Proxy nötig
- **Config Flow** — Einrichtung komplett über die HA-Oberfläche (Einstellungen → Integrationen)

---

## Installation

### Manuell

1. Ordner `custom_components/mursteiner/` nach `/config/custom_components/mursteiner/` kopieren
2. Home Assistant neu starten
3. **Einstellungen → Geräte & Dienste → Integration hinzufügen → "Mursteiner"**

### HACS (Custom Repository)

1. HACS → Integrationen → ⋮ → Benutzerdefinierte Repositories
2. URL: `https://github.com/mursteiner/ha-mursteiner`  Kategorie: **Integration**
3. "Mursteiner Dashboard" installieren & HA neu starten
4. **Einstellungen → Geräte & Dienste → Integration hinzufügen → "Mursteiner"**

---

## Einrichtung

### Bus-Sensor

Bei der Einrichtung werden abgefragt:
- **Haltestelle** (z.B. `Klagenfurt Kriemhildgasse`)
- **Richtung** (z.B. `Klagenfurt Heiligengeistplatz`)
- **Linie** (z.B. `Bus 5`)
- **Max. Abfahrten** (Standard: 5)
- **Aktualisierung** (Standard: 60 Sekunden)

### Lovelace Card

Die Card wird automatisch registriert. Falls nicht, manuell als Ressource hinzufügen:

```
/mursteiner/mursteiner-bus-card.js  (JavaScript-Modul)
```

---

## Card-Konfiguration

### Bus-Abfahrten

```yaml
type: custom:mursteiner-bus-card
entity: sensor.bus_5_kriemhildgasse
color: '#4FC3F7'
title: 'Bus 5 → Heiligengeistplatz'
```

---

## Sensor-Attribute

Der Bus-Sensor liefert:

| Attribut | Beschreibung |
|---|---|
| `station` | Haltestellenname |
| `direction` | Richtung |
| `line` | Linie |
| `next_in_minutes` | Minuten bis zum nächsten Bus |
| `next_realtime` | Echtzeit-Abfahrt des nächsten Busses |
| `next_delay` | Verspätung in Minuten |
| `departures` | Liste aller Abfahrten mit Details |

Jede Abfahrt enthält: `scheduled`, `realtime`, `date`, `line`, `destination`, `delay_minutes`, `minutes_until`.
