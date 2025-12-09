/**
 * Export Utilities
 * Functions for exporting data to CSV and Excel formats
 */

// Export to CSV
function exportToCSV(data, filename, columns) {
  if (!data || data.length === 0) {
    notifyError("Tidak ada data untuk diekspor");
    return;
  }

  // Create CSV header
  const headers = columns.map(col => col.label).join(',');
  
  // Create CSV rows
  const rows = data.map(item => {
    return columns.map(col => {
      let value = col.getValue ? col.getValue(item) : item[col.key] || '';
      // Escape quotes and wrap in quotes if contains comma
      value = String(value).replace(/"/g, '""');
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`;
      }
      return value;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  
  // Create download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  
  notifySuccess("File CSV berhasil diunduh!");
}

// Export to Excel (using SheetJS if available, otherwise fallback to CSV)
function exportToExcel(data, filename, columns) {
  if (!data || data.length === 0) {
    notifyError("Tidak ada data untuk diekspor");
    return;
  }

  // Check if SheetJS is available
  if (typeof XLSX !== 'undefined') {
    // Convert data to array format for SheetJS
    const headers = columns.map(col => col.label);
    const rows = data.map(item => {
      return columns.map(col => {
        return col.getValue ? col.getValue(item) : item[col.key] || '';
      });
    });

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    notifySuccess("File Excel berhasil diunduh!");
  } else {
    // Fallback to CSV if SheetJS not available
    console.warn("SheetJS not available, falling back to CSV");
    exportToCSV(data, filename, columns);
  }
}

// Group data by month
function groupDataByMonth(data, dateField) {
  const grouped = {};
  
  data.forEach(item => {
    const date = new Date(item[dateField]);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = { label: monthLabel, items: [] };
    }
    grouped[monthKey].items.push(item);
  });

  // Sort by month descending
  return Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, val]) => val);
}

// Get status badge HTML
function getStatusBadgeHTML(status) {
  const statusMap = {
    'Disetujui': 'bg-green-100 text-green-700',
    'Ditolak': 'bg-red-100 text-red-700',
    'Menunggu Persetujuan': 'bg-amber-100 text-amber-700',
    'Dikembalikan': 'bg-blue-100 text-blue-700',
    'Dipinjam': 'bg-purple-100 text-purple-700',
    'Selesai': 'bg-green-100 text-green-700'
  };
  const colorClass = statusMap[status] || 'bg-gray-100 text-gray-700';
  return `<span class="px-2 py-1 rounded-lg text-xs font-medium ${colorClass}">${status}</span>`;
}
