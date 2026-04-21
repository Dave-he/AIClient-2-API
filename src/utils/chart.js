export class SimpleChart {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.data = [];
    this.options = {
      lineColor: options.lineColor || '#059669',
      fillColor: options.fillColor || 'rgba(5, 150, 105, 0.1)',
      maxPoints: options.maxPoints || 100,
      maxValue: options.maxValue || 100,
      minValue: options.minValue || 0,
      label: options.label || '',
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
    if (!this.canvas || !this.ctx || this.data.length === 0) return;
    
    this.resize();
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const padding = { top: 20, right: 10, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const { maxValue, minValue, lineColor, fillColor } = this.options;

    ctx.clearRect(0, 0, width, height);
    
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
      ctx.fillText(Math.round(value), padding.left - 8, y + 4);
    }

    // Draw data line
    if (this.data.length < 2) return;

    const stepX = chartWidth / (this.options.maxPoints - 1);
    
    // Fill area under line
    ctx.beginPath();
    this.data.forEach((value, index) => {
      const x = padding.left + index * stepX;
      const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(padding.left + (this.data.length - 1) * stepX, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    this.data.forEach((value, index) => {
      const x = padding.left + index * stepX;
      const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw last point indicator
    if (this.data.length > 0) {
      const lastValue = this.data[this.data.length - 1];
      const lastX = padding.left + (this.data.length - 1) * stepX;
      const lastY = padding.top + chartHeight - ((lastValue - minValue) / (maxValue - minValue)) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  clear() {
    this.data = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
