/**
 * History Modal Component
 * Reusable component for viewing loan/reservation history with export functionality
 */

const historyModalState = {
  type: null, // 'asset', 'transport', 'room'
  data: [],
  period: '30d',
  status: 'all',
  customStart: null,
  customEnd: null
};

/**
 * Open history modal for a specific type
 * @param {string} type - 'asset', 'transport', or 'room'
 */
async function openHistoryModal(type) {
  historyModalState.type = type;
  historyModalState.data = [];
  historyModalState.period = '30d';
  historyModalState.status = 'all';
  
  const titleMap = {
    asset: 'Riwayat Peminjaman Barang',
    transport: 'Riwayat Peminjaman Transportasi',
    room: 'Riwayat Reservasi Ruangan'
  };
  
  let modal = document.getElementById('history-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.className = 'modal fixed inset-0 bg-gray-900/50 backdrop-blur-sm hidden items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 flex justify-between items-center">
          <h2 id="history-modal-title" class="text-xl font-bold"></h2>
          <button onclick="closeHistoryModal()" class="text-white/80 hover:text-white text-2xl">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="p-6 border-b bg-gray-50">
          <div class="flex flex-wrap gap-4 items-end">
            <div class="flex-1 min-w-[200px]">
              <label class="block text-sm font-medium text-gray-700 mb-1">Periode</label>
              <select id="history-period" onchange="handleHistoryFilterChange()" 
                class="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500">
                <option value="7d">7 Hari Terakhir</option>
                <option value="30d" selected>30 Hari Terakhir</option>
                <option value="3m">3 Bulan Terakhir</option>
                <option value="6m">6 Bulan Terakhir</option>
                <option value="1y">1 Tahun Terakhir</option>
                <option value="custom">Pilih Tanggal...</option>
              </select>
            </div>
            
            <div id="history-custom-dates" class="hidden flex gap-2 flex-1 min-w-[300px]">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Dari</label>
                <input type="date" id="history-start" onchange="handleHistoryFilterChange()" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-xl">
              </div>
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Sampai</label>
                <input type="date" id="history-end" onchange="handleHistoryFilterChange()" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-xl">
              </div>
            </div>
            
            <div class="flex-1 min-w-[180px]">
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select id="history-status" onchange="handleHistoryFilterChange()" 
                class="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500">
                <option value="all">Semua Status</option>
                <option value="Disetujui">Disetujui</option>
                <option value="Ditolak">Ditolak</option>
                <option value="Menunggu Persetujuan">Menunggu</option>
                <option value="Dikembalikan">Dikembalikan</option>
              </select>
            </div>
            
            <div class="flex gap-2">
              <button onclick="exportHistoryToCSV()" 
                class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 flex items-center gap-2 shadow-md">
                <i class="fas fa-file-csv"></i> CSV
              </button>
              <button onclick="exportHistoryToExcel()" 
                class="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 shadow-md">
                <i class="fas fa-file-excel"></i> Excel
              </button>
            </div>
          </div>
        </div>
        
        <div id="history-content" class="flex-1 overflow-y-auto p-6">
          <div class="flex justify-center py-12">
            <i class="fas fa-spinner fa-spin text-3xl text-amber-500"></i>
          </div>
        </div>
        
        <div class="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
          <span id="history-count" class="text-sm text-gray-600"></span>
          <button onclick="closeHistoryModal()" class="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300">
            Tutup
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('history-modal-title').textContent = titleMap[type] || 'Riwayat';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  await loadHistoryData();
}

function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function handleHistoryFilterChange() {
  const period = document.getElementById('history-period').value;
  const customDates = document.getElementById('history-custom-dates');
  
  if (period === 'custom') {
    customDates.classList.remove('hidden');
    historyModalState.customStart = document.getElementById('history-start').value;
    historyModalState.customEnd = document.getElementById('history-end').value;
  } else {
    customDates.classList.add('hidden');
  }
  
  historyModalState.period = period;
  historyModalState.status = document.getElementById('history-status').value;
  loadHistoryData();
}

function getDateRange() {
  const now = new Date();
  let startDate;
  
  switch (historyModalState.period) {
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'custom':
      return {
        start: historyModalState.customStart ? new Date(historyModalState.customStart).toISOString() : null,
        end: historyModalState.customEnd ? new Date(historyModalState.customEnd + 'T23:59:59').toISOString() : null
      };
    default:
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
  
  return {
    start: startDate.toISOString(),
    end: now.toISOString()
  };
}

async function loadHistoryData() {
  const content = document.getElementById('history-content');
  content.innerHTML = `<div class="flex justify-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-amber-500"></i></div>`;
  
  const { start, end } = getDateRange();
  const status = historyModalState.status;
  
  const actionMap = {
    asset: 'getAssetLoanHistory',
    transport: 'getTransportLoanHistory',
    room: 'getRoomReservationHistory'
  };
  
  try {
    const data = await api.post('/api/management', {
      action: actionMap[historyModalState.type],
      payload: { startDate: start, endDate: end, status: status === 'all' ? null : status }
    });
    
    historyModalState.data = data || [];
    renderHistoryTable();
  } catch (error) {
    content.innerHTML = `<div class="text-center text-red-500 py-12"><i class="fas fa-exclamation-circle text-3xl mb-3"></i><p>Gagal memuat data: ${error.message}</p></div>`;
  }
}

function renderHistoryTable() {
  const content = document.getElementById('history-content');
  const data = historyModalState.data;
  
  document.getElementById('history-count').textContent = `Total: ${data.length} data`;
  
  if (!data || data.length === 0) {
    content.innerHTML = `
      <div class="text-center py-12 text-gray-400">
        <i class="fas fa-inbox text-5xl mb-4"></i>
        <p class="text-lg">Tidak ada data untuk periode ini</p>
      </div>
    `;
    return;
  }
  
  // Group by month
  const grouped = {};
  data.forEach(item => {
    const date = getItemDate(item);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = { name: monthName, items: [] };
    }
    grouped[monthKey].items.push(item);
  });
  
  // Render grouped tables
  const sortedKeys = Object.keys(grouped).sort().reverse();
  
  content.innerHTML = sortedKeys.map(key => {
    const group = grouped[key];
    return `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <h3 class="font-bold text-gray-800">${group.name}</h3>
          <span class="text-sm text-gray-500">(${group.items.length} data)</span>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 text-gray-600">
              ${getTableHeader()}
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${group.items.map(item => getTableRow(item)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

function getItemDate(item) {
  switch (historyModalState.type) {
    case 'asset':
      return new Date(item.loan_date);
    case 'transport':
      return new Date(item.borrow_start);
    case 'room':
      return new Date(item.start_time);
    default:
      return new Date();
  }
}

function getTableHeader() {
  switch (historyModalState.type) {
    case 'asset':
      return `<tr>
        <th class="p-3 text-left">Tanggal</th>
        <th class="p-3 text-left">Barang</th>
        <th class="p-3 text-left">Peminjam</th>
        <th class="p-3 text-left">Status</th>
        <th class="p-3 text-left">Keterangan</th>
      </tr>`;
    case 'transport':
      return `<tr>
        <th class="p-3 text-left">Tanggal</th>
        <th class="p-3 text-left">Kendaraan</th>
        <th class="p-3 text-left">Peminjam</th>
        <th class="p-3 text-left">Tujuan</th>
        <th class="p-3 text-left">Status</th>
      </tr>`;
    case 'room':
      return `<tr>
        <th class="p-3 text-left">Tanggal</th>
        <th class="p-3 text-left">Ruangan</th>
        <th class="p-3 text-left">Acara</th>
        <th class="p-3 text-left">Pemohon</th>
        <th class="p-3 text-left">Status</th>
      </tr>`;
    default:
      return '';
  }
}

function getTableRow(item) {
  const statusBadge = getStatusBadge(item.status);
  
  switch (historyModalState.type) {
    case 'asset':
      const itemName = item.item_name || item.product_templates?.name || item.product_units?.template?.name || 'Barang';
      return `<tr class="hover:bg-gray-50">
        <td class="p-3">${new Date(item.loan_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
        <td class="p-3 font-medium">${itemName}${item.quantity > 1 ? ` (x${item.quantity})` : ''}</td>
        <td class="p-3">${item.profiles?.full_name || '-'}</td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3 text-gray-500 text-xs">${item.return_date ? 'Dikembalikan ' + new Date(item.return_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) : (item.due_date ? 'Jatuh tempo ' + new Date(item.due_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-')}</td>
      </tr>`;
    case 'transport':
      return `<tr class="hover:bg-gray-50">
        <td class="p-3">${new Date(item.borrow_start).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
        <td class="p-3 font-medium">${item.transportations?.vehicle_name || '-'}<br><span class="text-xs text-gray-400">${item.transportations?.plate_number || ''}</span></td>
        <td class="p-3">${item.profiles?.full_name || '-'}</td>
        <td class="p-3">${item.destination || '-'}</td>
        <td class="p-3">${statusBadge}</td>
      </tr>`;
    case 'room':
      return `<tr class="hover:bg-gray-50">
        <td class="p-3">${new Date(item.start_time).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
        <td class="p-3 font-medium">${item.room_name || '-'}</td>
        <td class="p-3">${item.event_name || '-'}</td>
        <td class="p-3">${item.requester_name || '-'}</td>
        <td class="p-3">${statusBadge}</td>
      </tr>`;
    default:
      return '';
  }
}

function getStatusBadge(status) {
  const statusConfig = {
    'Disetujui': { bg: 'bg-green-100', text: 'text-green-700', icon: 'fa-check' },
    'Ditolak': { bg: 'bg-red-100', text: 'text-red-700', icon: 'fa-times' },
    'Menunggu Persetujuan': { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'fa-clock' },
    'Dipinjam': { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'fa-hand-holding' },
    'Dikembalikan': { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'fa-undo' }
  };
  
  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'fa-question' };
  return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}">
    <i class="fas ${config.icon}"></i> ${status}
  </span>`;
}

function exportHistoryToCSV() {
  const data = historyModalState.data;
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diekspor');
    return;
  }
  
  const rows = [getCSVHeaders()];
  data.forEach(item => rows.push(getCSVRow(item)));
  
  const csv = rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csv, `riwayat_${historyModalState.type}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function exportHistoryToExcel() {
  // For Excel, we'll create a simple HTML table that Excel can open
  const data = historyModalState.data;
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diekspor');
    return;
  }
  
  let html = '<html><head><meta charset="UTF-8"></head><body><table border="1">';
  html += '<tr>' + getCSVHeaders().map(h => `<th>${h}</th>`).join('') + '</tr>';
  data.forEach(item => {
    html += '<tr>' + getCSVRow(item).map(c => `<td>${c || ''}</td>`).join('') + '</tr>';
  });
  html += '</table></body></html>';
  
  downloadFile(html, `riwayat_${historyModalState.type}_${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel');
}

function getCSVHeaders() {
  switch (historyModalState.type) {
    case 'asset':
      return ['Tanggal Pinjam', 'Barang', 'Jumlah', 'Peminjam', 'Status', 'Tanggal Kembali', 'Jatuh Tempo'];
    case 'transport':
      return ['Tanggal Mulai', 'Tanggal Selesai', 'Kendaraan', 'Plat', 'Peminjam', 'Tujuan', 'Keperluan', 'Status'];
    case 'room':
      return ['Tanggal Mulai', 'Tanggal Selesai', 'Ruangan', 'Acara', 'Pemohon', 'Status'];
    default:
      return [];
  }
}

function getCSVRow(item) {
  const formatDate = (d) => d ? new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '';
  
  switch (historyModalState.type) {
    case 'asset':
      const itemName = item.item_name || item.product_templates?.name || item.product_units?.template?.name || 'Barang';
      return [
        formatDate(item.loan_date),
        itemName,
        item.quantity || 1,
        item.profiles?.full_name || '',
        item.status,
        formatDate(item.return_date),
        formatDate(item.due_date)
      ];
    case 'transport':
      return [
        formatDate(item.borrow_start),
        formatDate(item.borrow_end),
        item.transportations?.vehicle_name || '',
        item.transportations?.plate_number || '',
        item.profiles?.full_name || '',
        item.destination || '',
        item.purpose || '',
        item.status
      ];
    case 'room':
      return [
        formatDate(item.start_time),
        formatDate(item.end_time),
        item.room_name || '',
        item.event_name || '',
        item.requester_name || '',
        item.status
      ];
    default:
      return [];
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Export functions to global scope
window.openHistoryModal = openHistoryModal;
window.closeHistoryModal = closeHistoryModal;
window.handleHistoryFilterChange = handleHistoryFilterChange;
window.exportHistoryToCSV = exportHistoryToCSV;
window.exportHistoryToExcel = exportHistoryToExcel;
