// Chart js

var theme = {
  primary: 'var(--ds-primary)',
  secondary: 'var(--ds-secondary)',
  success: 'var(--ds-success)',
  info: 'var(--ds-info)',
  warning: 'var(--ds-warning)',
  danger: 'var(--ds-danger)',
  dark: 'var(--ds-dark)',
  light: 'var(--ds-light)',
  white: 'var(--ds-white)',
  infoDark: '#006C9C',
  successLight: '#77ED8B',
  gray100: 'var(--ds-gray-100)',
  gray200: 'var(--ds-gray-200)',
  gray300: 'var(--ds-gray-300)',
  gray400: 'var(--ds-gray-400)',
  gray500: 'var(--ds-gray-500)',
  gray600: 'var(--ds-gray-600)',
  gray700: 'var(--ds-gray-700)',
  gray800: 'var(--ds-gray-800)',
  gray900: 'var(--ds-gray-900)',
  black: 'var(--ds-black)',
  transparent: 'transparent',
};

// Add theme to the window object
window.theme = theme;

(function () {
  // Perfomance Chart

  if (document.getElementById('totalIncomeChart')) {
    var options = {
      series: [
        {
          name: 'Total Income',
          data: [31, 40, 28, 51, 42, 109, 100],
        },
      ],
      labels: ['Jan', 'Feb', 'March', 'April', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      chart: {
        height: 350,
        type: 'area',
        toolbar: {
          show: false,
        },
        fontFamily: 'Public Sans, serif',
      },
      dataLabels: {
        enabled: false,
      },
      markers: {
        size: 5,
        hover: {
          size: 6,
          sizeOffset: 3,
        },
      },
      colors: ['#00a76f'],
      stroke: {
        curve: 'smooth',
        width: 2,
      },
      grid: {
        show: true,
        borderColor: window.theme.gray300,
        strokeDashArray: 2,
      },
      xaxis: {
        labels: {
          show: true,
          align: 'right',
          minWidth: 0,
          maxWidth: 160,
          style: {
            fontSize: '12px',
            fontWeight: 400,
            colors: [window.theme.gray600],
            fontFamily: 'Public Sans, serif',
          },
        },
        axisBorder: {
          show: false,
          color: window.theme.gray300,
          height: 1,
          width: '100%',
          offsetX: 0,
          offsetY: 0,
        },
        axisTicks: {
          show: false,
          borderType: 'solid',
          color: window.theme.gray300,
          height: 6,
          offsetX: 0,
          offsetY: 0,
        },
      },
      legend: {
        show: false, // Disable built-in legend
      },
      yaxis: {
        labels: {
          formatter: function (e) {
            return e + 'k';
          },

          show: true,
          align: 'right',
          minWidth: 0,
          maxWidth: 160,
          style: {
            fontSize: '12px',
            fontWeight: 400,
            colors: window.theme.gray600,
            fontFamily: 'Public Sans, serif',
          },
        },
      },
    };
    var chart = new ApexCharts(document.querySelector('#totalIncomeChart'), options);
    chart.render();
  }

  if (document.getElementById('totalExpensesChart')) {
    var options = {
      series: [
        {
          name: 'Total Expenses',
          data: [11, 32, 45, 32, 34, 52, 41],
        },
      ],
      labels: ['Jan', 'Feb', 'March', 'April', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      chart: {
        height: 350,
        type: 'area',
        toolbar: {
          show: false,
        },
        fontFamily: 'Public Sans, serif',
      },
      grid: {
        show: true,
        borderColor: window.theme.gray300,
        strokeDashArray: 2,
      },
      dataLabels: {
        enabled: false,
      },
      markers: {
        size: 5,
        hover: {
          size: 6,
          sizeOffset: 3,
        },
      },
      colors: [window.theme.warning],
      stroke: {
        curve: 'smooth',
        width: 2,
      },

      xaxis: {
        labels: {
          show: true,
          align: 'right',
          minWidth: 0,
          maxWidth: 160,
          style: {
            fontSize: '12px',
            fontWeight: 400,
            colors: [window.theme.gray600],
            fontFamily: 'Public Sans, serif',
          },
        },
        axisBorder: {
          show: false,
          color: window.theme.gray300,
          height: 1,
          width: '100%',
          offsetX: 0,
          offsetY: 0,
        },
        axisTicks: {
          show: false,
          borderType: 'solid',
          color: window.theme.gray300,
          height: 6,
          offsetX: 0,
          offsetY: 0,
        },
      },
      legend: {
        show: false, // Disable built-in legend
      },
      yaxis: {
        labels: {
          formatter: function (e) {
            return e + 'k';
          },
          show: true,
          align: 'right',
          minWidth: 0,
          maxWidth: 160,
          style: {
            fontSize: '12px',
            fontWeight: 400,
            colors: window.theme.gray600,
            fontFamily: 'Public Sans, serif',
          },
        },
      },
    };
    var chart = new ApexCharts(document.querySelector('#totalExpensesChart'), options);
    chart.render();
  }



})();
document.addEventListener('DOMContentLoaded', function() {
    if (typeof flatpickr !== 'undefined') {
        // Створюємо екземпляр flatpickr, але не прив'язуємо його до автоматичного відкриття
        const fp = flatpickr("#custom-range-menu-item", {
            locale: "uk",
            mode: "range",
            dateFormat: "Y-m-d",
            maxDate: "today",
            minDate: new Date().fp_incr(-30),
            disableMobile: true, // КРИТИЧНО для Telegram
            inline: false,
            static: false,
            appendTo: document.body, // Виносимо за межі DOM-дерева меню
            onClose: function(selectedDates, dateStr, instance) {
                if (selectedDates.length > 0) {
                    const start = instance.formatDate(selectedDates[0], "Y-m-d");
                    const end = selectedDates.length > 1 ? instance.formatDate(selectedDates[1], "Y-m-d") : start;
                    
                    customDateRange = { start, end };
                    
                    let displayText = instance.formatDate(selectedDates[0], "d.m");
                    if (selectedDates.length > 1) {
                        displayText += " - " + instance.formatDate(selectedDates[1], "d.m");
                    }
                    
                    // Викликаємо оновлення
                    changeDashboardPeriod('custom', displayText);
                    
                    // Закриваємо дропдаун Bootstrap вручну після вибору
                    const dropdownElement = document.querySelector('[data-bs-toggle="dropdown"]');
                    const bootstrapDropdown = bootstrap.Dropdown.getInstance(dropdownElement);
                    if (bootstrapDropdown) bootstrapDropdown.hide();
                }
            }
        });

        // Ручне відкриття при кліку (для TMA це надійніше)
        document.getElementById('custom-range-menu-item').addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fp.open(); // Явно відкриваємо календар
        });
    }
});
