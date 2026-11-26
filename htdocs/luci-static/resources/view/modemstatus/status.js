'use strict';
'require view';
'require rpc';
'require poll';
'require uci';

var callStatus     = rpc.declare({ object: 'luci.modemstatus', method: 'status' });
var callSetRefresh = rpc.declare({ object: 'luci.modemstatus', method: 'set_refresh', params: [ 'value' ] });

function fmt_bytes(b) {
	if (b == null || isNaN(b)) return '—';
	if (b < 1024) return b + ' B';
	if (b < 1048576) return (b / 1024).toFixed(1) + ' KiB';
	if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MiB';
	return (b / 1073741824).toFixed(2) + ' GiB';
}

function sig_color(q) {
	if (q === 'Excellent') return 'green';
	if (q === 'Good')      return 'amber';
	if (q === 'Fair')      return 'amber';
	return 'red';
}

function pill(val, unit, q) {
	if (val == null) return '<span style="color:var(--color-text-secondary);font-size:12px;">—</span>';
	var c = sig_color(q);
	var colors = {
		green: { bg: '#EAF3DE', fg: '#3B6D11' },
		amber: { bg: '#FAEEDA', fg: '#854F0B' },
		red:   { bg: '#FCEBEB', fg: '#A32D2D' }
	};
	var col = colors[c] || colors.red;
	return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:500;background:' + col.bg + ';color:' + col.fg + ';">' +
		val + ' ' + unit + ' <span style="opacity:.8;font-size:10px;font-weight:400;">' + q + '</span></span>';
}

function kv(k, v) {
	return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;">' +
		'<span style="color:var(--color-text-secondary);">' + k + '</span>' +
		'<span style="font-weight:500;text-align:right;max-width:58%;word-break:break-all;">' + v + '</span></div>';
}

function hash(v) {
	return '<span class="hash-val" data-val="' + v + '" style="font-family:var(--font-mono);font-size:11px;color:var(--color-text-secondary);">' + v + '</span>';
}

function sensitive(v) {
	return '<span class="hash-val sensitive-val" data-val="' + v + '" style="font-family:var(--font-mono);font-size:11px;color:var(--color-text-secondary);">' + v + '</span>';
}

function badge(text, color) {
	var colors = {
		green: { bg: '#EAF3DE', fg: '#3B6D11' },
		blue:  { bg: '#E6F1FB', fg: '#185FA5' },
		amber: { bg: '#FAEEDA', fg: '#854F0B' },
		red:   { bg: '#FCEBEB', fg: '#A32D2D' }
	};
	var col = colors[color] || colors.blue;
	return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;background:' + col.bg + ';color:' + col.fg + ';">' + text + '</span>';
}

function sig_bars(csq) {
	var pct = csq >= 99 ? 0 : Math.round((csq / 31) * 100);
	var filled = Math.round(pct / 20);
	var html = '<div style="display:flex;align-items:flex-end;gap:4px;height:36px;">';
	for (var i = 1; i <= 5; i++) {
		var h = 10 + (i - 1) * 7;
		var on = i <= filled;
		var bg = on ? '#639922' : 'var(--color-border-tertiary)';
		html += '<div style="width:9px;height:' + h + 'px;border-radius:2px 2px 0 0;background:' + bg + ';"></div>';
	}
	html += '</div>';
	return html;
}

function card(title, content) {
	return '<div style="background:var(--color-background-primary);border:1px solid #4a5568;border-radius:var(--border-radius-lg);padding:16px 18px;">' +
		'<div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-secondary);margin-bottom:10px;border-bottom:0.5px solid var(--color-border-tertiary);padding-bottom:8px;">' + title + '</div>' +
		content + '</div>';
}

function render_status(d) {
	if (!d) return '<p style="color:var(--color-text-secondary);font-size:13px;">Failed to retrieve modem data.</p>';

	// ── Connection card ──
	var conn_html =
		'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
			sig_bars(d.csq) +
			'<span style="font-size:28px;font-weight:500;">' + (d.csq < 99 ? Math.round((d.csq / 31) * 100) : 0) + '%</span>' +
		'</div>' +
		kv('State',      badge('Connected', 'green')) +
		kv('Operator',   d.operator || '—') +
		kv('MCC / MNC',  (d.mcc || '—') + ' / ' + (d.mnc || '—')) +
		kv('Technology', badge(d.technology || '—', 'blue')) +
		'<div style="border-top:0.5px solid var(--color-border-tertiary);margin:6px 0;"></div>' +
		kv('▲ Sent',     fmt_bytes(d.sent_bytes)) +
		kv('▼ Received', fmt_bytes(d.recv_bytes));

	// ── SIM card ──
	var sim_html =
		kv('Slot',   'SIM 1') +
		kv('Status', badge(d.sim_status || '—', d.sim_status === 'READY' ? 'green' : 'amber')) +
		kv('IMSI',   sensitive(d.imsi  || '—')) +
		kv('ICCID',  sensitive(d.iccid || '—'));

	// ── Modem info card ──
	var modem_html =
		kv('Type',        (d.manufacturer || '') + ' ' + (d.model || '')) +
		kv('Firmware',    '<span style="font-size:11px;font-family:var(--font-mono);">' + (d.firmware || '—') + '</span>') +
		kv('IMEI',        sensitive(d.imei || '—')) +
		'<div style="margin-top:6px;display:flex;align-items:center;gap:6px;">' +
			'<span style="font-size:13px;">🌡</span>' +
			'<span style="font-size:18px;font-weight:500;">' + (d.temp != null ? d.temp + ' °C' : '—') + '</span>' +
		'</div>';

	// ── Cell info card ──
	var cell_html =
		kv('Cell ID', hash(d.cell_id || '—')) +
		kv('TAC',     d.tac || '—') +
		kv('eNB ID',  d.enb_id || '—') +
		kv('PCI',     d.pci || '—') +
		kv('MCC',     d.mcc || '—') +
		kv('MNC',     d.mnc || '—');

	// ── Signal levels card (primary band) ──
	function bar_html(pct, q) {
		var c = sig_color(q);
		var colors = { green: '#639922', amber: '#BA7517', red: '#E24B4A' };
		var fill = colors[c] || colors.red;
		return '<div style="height:8px;background:var(--color-background-tertiary);border-radius:4px;overflow:hidden;margin-top:3px;">' +
			'<div style="height:100%;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + fill + ';border-radius:4px;"></div></div>';
	}

	function sig_row(name, val, unit, q, pct, desc) {
		var qcolor = { Excellent: '#3B6D11', Good: '#854F0B', Fair: '#854F0B', Poor: '#A32D2D' };
		var vstr = val != null ? val + ' ' + unit + ' | ' + q : '—';
		return '<div style="margin-bottom:14px;">' +
			'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">' +
				'<span style="font-size:13px;font-weight:500;">' + name + '</span>' +
				'<span style="font-size:13px;font-weight:500;color:' + (qcolor[q] || '#888') + ';">' + vstr + '</span>' +
			'</div>' +
			(val != null ? bar_html(pct, q) : '') +
			'<div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px;">' + desc + '</div>' +
		'</div>';
	}

	var csq_pct  = d.csq < 99  ? Math.round((d.csq / 31) * 100)      : 0;
	var rssi_pct = d.rssi != null ? Math.round(Math.max(0, (d.rssi + 110) / 55 * 100)) : 0;
	var rsrp_pct = d.rsrp != null ? Math.round(Math.max(0, (d.rsrp + 140) / 80 * 100)) : 0;
	var rsrq_pct = d.rsrq != null ? Math.round(Math.max(0, (d.rsrq + 20)  / 15 * 100)) : 0;
	var sinr_pct = d.sinr != null ? Math.round(Math.max(0, (d.sinr + 20)  / 50 * 100)) : 0;

	var sigcard_html =
		sig_row('CSQ',  d.csq < 99 ? d.csq : null, '',    d.csq_q  || '', csq_pct,  'Signal strength (0–31 scale)') +
		sig_row('RSSI', d.rssi, 'dBm', d.rssi_q || '', rssi_pct, 'Received signal strength indicator') +
		sig_row('RSRP', d.rsrp, 'dBm', d.rsrp_q || '', rsrp_pct, 'Reference signal received power') +
		sig_row('RSRQ', d.rsrq, 'dB',  d.rsrq_q || '', rsrq_pct, 'Reference signal received quality') +
		sig_row('SINR', d.sinr, 'dB',  d.sinr_q || '', sinr_pct, 'Signal to interference + noise ratio');

	// ── Band table ──
	var band_rows = '';
	var bands = d.bands || [];
	for (var i = 0; i < bands.length; i++) {
		var b = bands[i];
		var is_pcc = b.type === 'PCC';
		var is_nr  = b.is_nr;
		var row_bg = is_nr  ? 'background:rgba(56,130,220,0.15);outline:1px solid rgba(56,130,220,0.3);' :
		             is_pcc ? 'background:var(--color-background-secondary);' : '';
		var label = (is_pcc ? b.type : 'SCC' + i) + ' ' + b.band;
		if (is_nr) label += ' <span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:500;background:#378ADD;color:#fff;margin-left:3px;">5G</span>';
		band_rows +=
			'<tr style="' + row_bg + '">' +
			'<td style="padding:7px 8px;font-size:12px;' + (is_pcc ? 'font-weight:500;' : '') + '">' + label + '</td>' +
			'<td style="padding:7px 8px;font-size:12px;">' + (b.bw || '—') + '</td>' +
			'<td style="padding:7px 8px;font-size:12px;">' + (b.pci || '—') + '</td>' +
			'<td style="padding:7px 8px;font-size:12px;">' + (b.earfcn || '—') + '</td>' +
			'<td style="padding:7px 8px;">' + (b.rssi != null ? pill(b.rssi, 'dBm', b.rssi_q) : '<span style="color:var(--color-text-secondary);font-size:12px;">—</span>') + '</td>' +
			'<td style="padding:7px 8px;">' + pill(b.rsrp, 'dBm', b.rsrp_q) + '</td>' +
			'<td style="padding:7px 8px;">' + pill(b.rsrq, 'dB',  b.rsrq_q) + '</td>' +
			'<td style="padding:7px 8px;">' + pill(b.sinr, 'dB',  b.sinr_q) + '</td>' +
			'</tr>';
	}
	if (!band_rows) band_rows = '<tr><td colspan="8" style="padding:1.5em;text-align:center;color:var(--color-text-secondary);font-size:12px;">No carrier aggregation data</td></tr>';

	var band_html =
		'<div style="overflow-x:auto;">' +
		'<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">' +
		'<thead><tr style="background:var(--color-background-secondary);">' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:150px;">Band</th>' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:80px;">BW</th>' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:50px;">PCI</th>' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:70px;">ARFCN</th>' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:115px;">RSSI</th>' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:115px;">RSRP</th>' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:100px;">RSRQ</th>' +
		'<th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-border-tertiary);width:100px;">SINR</th>' +
		'</tr></thead>' +
		'<tbody>' + band_rows + '</tbody>' +
		'</table></div>';

	return (
		'<div style="display:grid;grid-template-columns:2fr 1.4fr 1.4fr 1.2fr;gap:14px;margin-bottom:18px;">' +
			card('Connection',    conn_html) +
			card('SIM card',      sim_html) +
			card('Modem',         modem_html) +
			card('Cell info',     cell_html) +
		'</div>' +
		'<div style="font-size:15px;font-weight:500;margin-bottom:8px;">Primary band signal</div>' +
		'<div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:16px 18px;margin-bottom:14px;">' +
			sigcard_html +
		'</div>' +
		'<div style="font-size:15px;font-weight:500;margin-bottom:8px;">Bands</div>' +
		'<div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);overflow:hidden;">' +
			band_html +
		'</div>'
	);
}

return view.extend({
	title: _('Signal Strength'),

	load: function() {
		// Drop any cached copy so the dropdown always reflects what's actually
		// saved on disk (set_refresh writes via the backend, bypassing the
		// client-side uci cache, so a plain uci.load could return stale data
		// on an in-app revisit).
		uci.unload('modemstatus');
		return uci.load('modemstatus').then(function() { return callStatus(); });
	},

	render: function(data) {
		var cfgRefresh = uci.get('modemstatus', 'global', 'refresh');
		var REFRESH = (cfgRefresh != null && cfgRefresh !== '') ? parseInt(cfgRefresh, 10) : 10;
		if (isNaN(REFRESH) || REFRESH < 0) REFRESH = 10;
		var countdown = REFRESH;
		var hidden = false;
		var timer = null;
		var container = E('div', { style: 'font-size:13px;color:var(--color-text-primary);padding:12px 0;' });
		var countEl = E('div', { style: 'font-size:11px;color:var(--color-text-secondary);margin-bottom:4px;' },
			_('Updating again in ') + countdown + _(' second(s).'));

		function apply_hide(hide) {
			hidden = hide;
			container.querySelectorAll('.sensitive-val').forEach(function(el) {
				el.textContent = hide ? '••••••••••••••' : el.dataset.val;
			});
		}

		function start_timer() {
			if (timer) clearInterval(timer);
			if (REFRESH <= 0) { countEl.textContent = _('Disabled.'); return; }
			countdown = REFRESH;
			countEl.textContent = _('Updating again in ') + countdown + _(' second(s).');
			timer = setInterval(function() {
				countdown--;
				if (countdown <= 0) {
					countEl.textContent = _('Refreshing…');
					clearInterval(timer);
					timer = null;
					callStatus().then(function(d) {
						container.innerHTML = render_status(d);
						if (hidden) apply_hide(true);
						start_timer();
					});
					return;
				}
				countEl.textContent = _('Updating again in ') + countdown + _(' second(s).');
			}, 1000);
		}

		var refreshSel = E('select', { style: 'font-size:12px;', id: 'refresh-select' }, [
			E('option', { value: '3'  }, '3 ' + _('seconds')),
			E('option', { value: '5'  }, '5 ' + _('seconds')),
			E('option', { value: '10' }, '10 ' + _('seconds')),
			E('option', { value: '30' }, '30 ' + _('seconds')),
			E('option', { value: '60' }, '60 ' + _('seconds')),
			E('option', { value: '0'  }, _('Disabled'))
		]);
		refreshSel.value = String(REFRESH);
		refreshSel.addEventListener('change', function() {
			REFRESH = parseInt(refreshSel.value, 10);
			start_timer();
			// Persist so the choice survives reloads/navigation.
			callSetRefresh(String(refreshSel.value)).catch(function() {});
		});

		var hideCheck = E('input', { type: 'checkbox', id: 'hide-check' });
		hideCheck.addEventListener('change', function() {
			apply_hide(hideCheck.checked);
		});

		var topbar = E('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;' }, [
			E('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
				E('label', { style: 'font-size:12px;color:var(--color-text-secondary);' }, _('Auto update every:')),
				refreshSel
			]),
			E('label', { style: 'font-size:12px;color:var(--color-text-secondary);' }, [
				hideCheck,
				' ' + _('Hide sensitive data')
			])
		]);

		var modemLink = E('div', { style: 'font-size:12px;color:var(--color-text-info);margin-bottom:14px;' },
			(data && data.manufacturer ? data.manufacturer + ' ' + data.model : 'Quectel RM520N-GL') + ' (main)');

		container.innerHTML = render_status(data);
		start_timer();

		return E('div', {}, [ topbar, countEl, modemLink, container ]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null
});
