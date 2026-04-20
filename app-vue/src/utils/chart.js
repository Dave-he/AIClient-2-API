export class SimpleChart {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.data = [];
    this.series = [];
    this.options = {
      lineColor: options.lineColor || '#059669',
      fillColor: options.fillColor || 'rgba(5, 150, 105, 0.1)',
      maxPoints: options.maxPoints || 100,
      maxValue: options.maxValue || 100,
      minValue: options.minValue || 0,
      label: options.label || '',
      yAxisFormatter: options.yAxisFormatter || ((value) => Math.round(value).toString()),
      xAxisLabels: options.xAxisLabels || null,
      secondaryAxis: options.secondaryAxis || null,
      ...options
    };
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight || 200;
    }
  }

  addPoint(value) {
    this.data.push(value);
    if (this.data.length > this.options.maxPoints) {
      this.data.shift();
    }
  }

  draw() {
    if (!this.canvas || !this.ctx) return;
    
    this.resize();
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const padding = { top: 20, right: 10, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const { maxValue, minValue, lineColor, fillColor, yAxisFormatter, xAxisLabels, secondaryAxis } = this.options;

    ctx.clearRect(0, 0, width, height);

    const datasetGroups = this.series.length > 0
      ? this.series.map((series) => ({
          ...series,
          data: Array.isArray(series.data) ? series.data : []
        })).filter((series) => series.data.length > 0)
      : (this.data.length > 0
        ? [{
            data: this.data,
            lineColor,
            fillColor,
            label: this.options.label,
            axis: 'primary'
          }]
        : []);

    if (datasetGroups.length === 0) return;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Draw labels
      const value = maxValue - ((maxValue - minValue) / 5) * i;
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(yAxisFormatter(value), padding.left - 8, y + 4);
    }

    if (secondaryAxis?.enabled) {
      ctx.fillStyle = secondaryAxis.color || '#ef4444';
      ctx.textAlign = 'left';
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        const value = secondaryAxis.maxValue - ((secondaryAxis.maxValue - secondaryAxis.minValue) / 5) * i;
        const formatter = secondaryAxis.formatter || ((v) => Math.round(v).toString());
        ctx.fillText(formatter(value), width - padding.right + 8, y + 4);
      }
    }

    const longestSeries = datasetGroups.reduce((max, current) => Math.max(max, current.data.length), 0);
    if (longestSeries < 2) return;

    const stepX = chartWidth / Math.max(longestSeries - 1, 1);

    datasetGroups.forEach((series, seriesIndex) => {
      const axisConfig = series.axis === 'secondary' && secondaryAxis?.enabled
        ? secondaryAxis
        : { minValue, maxValue };
      const lineStroke = series.lineColor || lineColor;
      const areaFill = series.fillColor || fillColor;

      if (series.fill !== false) {
        ctx.beginPath();
        series.data.forEach((value, index) => {
          const x = padding.left + index * stepX;
          const y = padding.top + chartHeight - ((value - axisConfig.minValue) / (axisConfig.maxValue - axisConfig.minValue || 1)) * chartHeight;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.lineTo(padding.left + (series.data.length - 1) * stepX, padding.top + chartHeight);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = areaFill;
        ctx.fill();
      }

      ctx.beginPath();
      series.data.forEach((value, index) => {
        const x = padding.left + index * stepX;
        const y = padding.top + chartHeight - ((value - axisConfig.minValue) / (axisConfig.maxValue - axisConfig.minValue || 1)) * chartHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = lineStroke;
      ctx.lineWidth = series.lineWidth || 2;
      ctx.lineJoin = 'round';
      if (series.dashed) {
        ctx.setLineDash([6, 4]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const lastValue = series.data[series.data.length - 1];
      const lastX = padding.left + (series.data.length - 1) * stepX;
      const lastY = padding.top + chartHeight - ((lastValue - axisConfig.minValue) / (axisConfig.maxValue - axisConfig.minValue || 1)) * chartHeight;

      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = lineStroke;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });

    const labels = Array.isArray(xAxisLabels) && xAxisLabels.length > 0
      ? xAxisLabels
      : null;
    if (labels && labels.length > 1) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      const step = Math.max(1, Math.ceil(labels.length / 5));
      for (let i = 0; i < labels.length; i += step) {
        const x = padding.left + i * (chartWidth / Math.max(labels.length - 1, 1));
        ctx.fillText(labels[i], x, height - 8);
      }
    }
  }

  clear() {
    this.data = [];
    this.series = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
