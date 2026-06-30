'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

interface BugTrendChartProps {
  /** 7 day labels e.g. ['Mon','Tue',...] */
  labels: string[]
  /** open bug counts per day */
  opened: number[]
  /** closed bug counts per day */
  closed: number[]
}

export default function BugTrendChart({ labels, opened, closed }: BugTrendChartProps) {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1b19',
        borderColor: '#2a2a28',
        borderWidth: 1,
        titleColor: '#7a7874',
        bodyColor: '#e2e0db',
        titleFont: { family: 'Geist Mono, monospace', size: 11 },
        bodyFont:  { family: 'Geist Mono, monospace', size: 11 },
        padding: 10,
        callbacks: {
          title: (items) => labels[items[0].dataIndex],
        },
      },
    },
    scales: {
      x: {
        grid:   { color: '#1e1e1c' },
        ticks:  { color: '#4a4846', font: { family: 'Geist Mono, monospace', size: 10 } },
        border: { color: '#242422' },
      },
      y: {
        grid:   { color: '#1e1e1c' },
        ticks:  { color: '#4a4846', font: { family: 'Geist Mono, monospace', size: 10 }, stepSize: 1 },
        border: { color: '#242422' },
        beginAtZero: true,
      },
    },
    interaction: { mode: 'index', intersect: false },
    elements: {
      point: { radius: 3, hoverRadius: 5 },
      line:  { tension: 0.35 },
    },
  }

  const data = {
    labels,
    datasets: [
      {
        label:           'opened',
        data:            opened,
        borderColor:     '#f87171',
        backgroundColor: 'rgba(248,113,113,0.08)',
        fill:            true,
        borderWidth:     1.5,
        pointBackgroundColor: '#f87171',
      },
      {
        label:           'closed',
        data:            closed,
        borderColor:     '#4ade80',
        backgroundColor: 'rgba(74,222,128,0.06)',
        fill:            true,
        borderWidth:     1.5,
        pointBackgroundColor: '#4ade80',
      },
    ],
  }

  return (
    <div style={{ position: 'relative', height: 140, width: '100%' }}>
      <Line options={options} data={data} />
    </div>
  )
}
