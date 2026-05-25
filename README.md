# luci-app-modemstatus

A LuCI application for OpenWrt that provides a real-time signal strength and carrier aggregation dashboard for Quectel 5G modems.

---

## Features

- **Live signal dashboard** — CSQ, RSSI, RSRP, RSRQ, and SINR with color-coded quality ratings (Excellent / Good / Fair / Poor) and visual progress bars
- **Carrier aggregation table** — PCC and SCC bands displayed with bandwidth, PCI, ARFCN, and per-band signal metrics; 5G NR bands highlighted
- **5G NSA detection** — automatically labels technology as `5G NSA (nCA)` when EN-DC is active via `AT+QENDC`
- **Connection info** — operator name, MCC/MNC, technology, and session data counters (sent/received bytes)
- **SIM card info** — slot, status, IMSI, and ICCID
- **Modem info** — manufacturer, model, firmware version, IMEI, and modem temperature
- **Cell info** — Cell ID, TAC, eNB ID, PCI, MCC, MNC
- **Configurable auto-refresh** — 5, 10, 30, or 60 second intervals, or disabled; countdown displayed in the UI
- **Sensitive data masking** — toggle to hide IMSI, ICCID, and IMEI; values are masked in-place without a page reload and remain masked across auto-refresh cycles

---

## Requirements

| Requirement | Details |
|---|---|
| OpenWrt | 23.05 or later (LuCI JavaScript view API required) |
| Modem | Quectel 5G (tested on RM520N-GL); other Quectel LTE/5G modems using standard AT commands should work |
| Package | [`sms-tool`](https://openwrt.org/packages/pkgdata/sms-tool) — used to send AT commands over the serial port |

---

## Installation

### From the OpenWrt build system

Clone this repository into your LuCI feed and build:

```bash
git clone https://github.com/youruser/luci-app-modemstatus package/luci-app-modemstatus
make menuconfig   # select LuCI > Applications > luci-app-modemstatus
make package/luci-app-modemstatus/compile
```

Install the resulting `.ipk` on your router:

```bash
opkg install luci-app-modemstatus_1.0.0-1_all.ipk
```

### Manual installation

Copy the package files directly to your router:

```bash
# Static JS view
scp htdocs/luci-static/resources/view/modemstatus/status.js \
    root@192.168.1.1:/www/luci-static/resources/view/modemstatus/status.js

# rpcd ucode backend
scp root/usr/share/rpcd/ucode/luci.modemstatus \
    root@192.168.1.1:/usr/share/rpcd/ucode/luci.modemstatus

# ACL definition
scp root/usr/share/rpcd/acl.d/luci-app-modemstatus.json \
    root@192.168.1.1:/usr/share/rpcd/acl.d/luci-app-modemstatus.json

# Menu entry
scp root/usr/share/luci/menu.d/luci-app-modemstatus.json \
    root@192.168.1.1:/usr/share/luci/menu.d/luci-app-modemstatus.json

# UCI config (first install only)
scp root/etc/config/modemstatus \
    root@192.168.1.1:/etc/config/modemstatus

# Restart services
ssh root@192.168.1.1 "service rpcd restart && service uhttpd restart"
```

> **Note:** If your router does not have `sftp-server` installed (common on OpenWrt), use `ssh` with stdin redirection instead of `scp`:
> ```bash
> ssh root@192.168.1.1 "cat > /path/to/file" < local_file
> ```

---

## Configuration

Edit `/etc/config/modemstatus` on the router:

```uci
config modemstatus 'global'
    option port  '/dev/ttyUSB2'   # AT command serial port
    option baud  '115200'         # Baud rate
```

The AT port is typically `/dev/ttyUSB2` for Quectel modems in USB mode. If your modem is connected via PCIe or a different USB enumeration order, adjust accordingly. Check `ls /dev/ttyUSB*` or `ls /dev/ttyACM*` on the router to find the correct port.

After editing, restart rpcd:

```bash
service rpcd restart
```

---

## AT Commands Used

The backend queries the modem using `sms-tool` over the configured serial port. The following AT commands are issued on each refresh:

| Command | Purpose |
|---|---|
| `AT+CGMI` | Manufacturer |
| `AT+CGMM` | Model |
| `AT+CGMR` | Firmware version |
| `AT+CGSN` | IMEI |
| `AT+CPIN?` | SIM status |
| `AT+QCCID` | ICCID |
| `AT+CIMI` | IMSI |
| `AT+COPS?` | Operator name and MCC/MNC |
| `AT+QNWINFO` | Access technology and primary band |
| `AT+QENDC` | EN-DC (5G NSA) capability and active state |
| `AT+CSQ` | CSQ signal strength (0–31 scale) |
| `AT+QCSQ` | Extended signal: RSSI, RSRP, RSRQ |
| `AT+QCAINFO` | Carrier aggregation band table |
| `AT+QENG="servingcell"` | Cell ID, TAC, eNB ID, PCI, MCC, MNC; NR5G-NSA signal |
| `AT+QTEMP` | Modem temperature (multiple sensor names tried) |
| `AT+QGDCNT?` | Session data counters (sent/received bytes) |

---

## Signal Quality Thresholds

| Metric | Excellent | Good | Fair | Poor |
|---|---|---|---|---|
| CSQ | ≥ 20 | ≥ 15 | ≥ 10 | < 10 |
| RSSI | ≥ −65 dBm | ≥ −75 dBm | ≥ −85 dBm | < −85 dBm |
| RSRP | ≥ −80 dBm | ≥ −90 dBm | ≥ −100 dBm | < −100 dBm |
| RSRQ | ≥ −10 dB | ≥ −15 dB | ≥ −20 dB | < −20 dB |
| SINR | ≥ 13 dB | ≥ 0 dB | ≥ −3 dB | < −3 dB |

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  Auto update every: [10 seconds ▾]    ☐ Hide sensitive  │
│  Updating again in 9 second(s).                         │
│  Quectel RM520N-GL (main)                               │
├──────────────┬────────────┬────────────┬────────────────┤
│  Connection  │  SIM card  │   Modem    │   Cell info    │
│  ▋▋▋▋▋  82% │  Slot      │  Type      │  Cell ID       │
│  State       │  Status    │  Firmware  │  TAC           │
│  Operator    │  IMSI *    │  IMEI *    │  eNB ID        │
│  MCC / MNC   │  ICCID *   │  Temp      │  PCI           │
│  Technology  │            │            │  MCC / MNC     │
│  ▲ Sent      │            │            │                │
│  ▼ Received  │            │            │                │
├──────────────┴────────────┴────────────┴────────────────┤
│  Primary band signal                                    │
│  CSQ   RSSI   RSRP   RSRQ   SINR  (bars + quality)     │
├─────────────────────────────────────────────────────────┤
│  Bands                                                  │
│  Band │ BW │ PCI │ ARFCN │ RSSI │ RSRP │ RSRQ │ SINR   │
│  PCC  │    │     │       │      │      │      │        │
│  SCC1 │    │     │       │      │      │      │        │
│  SCC2 │    │     │       │  5G  │      │      │        │
└─────────────────────────────────────────────────────────┘
```

*\* Masked when "Hide sensitive data" is checked*

---

## Navigation

The app appears in the LuCI menu under **Modem → Signal Strength**.

---

## Dependencies

- `sms-tool` — available in the OpenWrt package feeds. Install with:
  ```bash
  opkg update && opkg install sms-tool
  ```

---

## License

GPL-2.0-only — consistent with the OpenWrt/LuCI project.
