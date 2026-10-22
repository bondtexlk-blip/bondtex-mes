// Number and date formatters for Bondtex Production Dashboard

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatCompactNumber = (num) => {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

export const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'On Track':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Ahead':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Behind Plan':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Completed':
      return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
    case 'Pending':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-700/50 text-slate-300 border-slate-600';
  }
};

export const getCategoryColor = (category) => {
  switch (category) {
    case 'Loop':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        badge: 'bg-blue-600 text-white',
        hex: '#3b82f6',
      };
    case 'Strap':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        badge: 'bg-emerald-600 text-white',
        hex: '#10b981',
      };
    case 'T-shirt':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        badge: 'bg-amber-600 text-white',
        hex: '#f59e0b',
      };
    case 'Other':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        badge: 'bg-purple-600 text-white',
        hex: '#a855f7',
      };
    default:
      return {
        bg: 'bg-slate-800',
        text: 'text-slate-300',
        border: 'border-slate-700',
        badge: 'bg-slate-700 text-white',
        hex: '#64748b',
      };
  }
};
