    function renderChart(id, type, dataObj, isHoriz = false, totalBase = null, yTitle = '', xTitle = '') {
        if (charts[id]) charts[id].destroy();
        if (Object.keys(dataObj).length === 0) return;

        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e0e0e0' : '#232323';
        const gridColor = isDark ? '#333333' : '#d1d1d1';
        const isPie = type === 'pie';

        const colorBlue   = '#375B95';
        const colorOrange = '#D25600';

        let bgColors, borderColors;

        if (isPie) {
            bgColors = pieColors;
            borderColors = isDark ? '#1e1e1e' : '#fff';
        } else {
            const values = Object.values(dataObj);
            const maxVal = Math.max(...values);
            bgColors = values.map(v => (v === maxVal && values.length > 1) ? colorOrange : colorBlue);
            borderColors = bgColors;
        }

        let chartData = {
            labels: Object.keys(dataObj),
            datasets: [{
                data: Object.values(dataObj),
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: colorOrange
            }]
        };

        let options = {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: isPie, position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 11, family: "'DM Sans', sans-serif" } } },
                tooltip: {
                    titleFont: { family: "'DM Sans', sans-serif" },
                    bodyFont: { family: "'DM Sans', sans-serif", size: 13 },
                    callbacks: { label: (c) => {
                        if (id.includes('notas') || id.includes('banca') || id.includes('crit')) return ` ${c.raw}`;
                        let base = totalBase || c.dataset.data.reduce((a,b)=>a+b, 0);
                        return base > 0 ? ` ${c.raw} (${((c.raw*100)/base).toFixed(1)}%)` : ` ${c.raw}`;
                    }}
                },
                datalabels: {
                    color: (isPie ? '#fff' : (isDark ? '#e0e0e0' : '#232323')),
                    font: { weight: 'bold', size: 11, family: "'DM Sans', sans-serif" },
                    anchor: isHoriz ? 'end' : 'end',
                    align: isHoriz ? 'end' : 'end',
                    offset: 4,
                    formatter: (v, ctx) => {
                        if (id.includes('notas') || id.includes('banca') || id.includes('crit')) return v;
                        let base = totalBase || ctx.dataset.data.reduce((a,b)=>a+b, 0);
                        return base > 0 ? ((v*100)/base).toFixed(1) + "%" : v;
                    },
                    display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0
                }
            }
        };

        if (!isPie) {
            options.indexAxis = isHoriz ? 'y' : 'x';
            options.layout = { padding: { top: isHoriz ? 0 : 25, right: isHoriz ? 40 : 0 } };

            options.scales = {
                y: {
                    beginAtZero: isHoriz ? false : true,
                    max: (!isHoriz && (id.includes('banca-notas') || id.includes('banca-crit'))) ? 100 : (!isHoriz && id.includes('notas-bar') ? 5 : undefined),
                    ticks: { color: textColor, font: { family: "'DM Sans', sans-serif" } },
                    grid: { color: isHoriz ? 'transparent' : gridColor, drawBorder: false },
                    title: { display: !!yTitle, text: yTitle, color: textColor, font: { weight: 'bold', family: "'DM Sans', sans-serif" } }
                },
                x: {
                    beginAtZero: isHoriz ? true : false,
                    max: (isHoriz && (id.includes('banca-notas') || id.includes('banca-crit'))) ? 100 : (isHoriz && id.includes('notas-bar') ? 5 : undefined),
                    ticks: { color: textColor, font: { family: "'DM Sans', sans-serif" } },
                    grid: { color: isHoriz ? gridColor : 'transparent', drawBorder: false },
                    title: { display: !!xTitle, text: xTitle, color: textColor, font: { weight: 'bold', family: "'DM Sans', sans-serif" } }
                }
            };
        }

        charts[id] = new Chart(document.getElementById(id), { type: type, data: chartData, options: options });
    }
