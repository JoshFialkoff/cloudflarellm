import { useEffect, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false })
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false })

function useTrendsData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/data/trends.json')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { data, loading }
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>{title}</h2>
      {children}
    </section>
  )
}

function ChartWrapper({ height = 320, children }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export default function TrendsPage() {
  const { data, loading } = useTrendsData()

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p>Loading trends data…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p>Unable to load trends data.</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Massachusetts ALR Trends | Assistedly</title>
        <meta name="description" content={`Trends across ${data.facilityCount} Massachusetts assisted living residences for ${data.reportYear}.`} />
      </Head>

      <main style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 700 }}>Massachusetts Assisted Living Trends</h1>
        <p style={{ color: '#555', marginBottom: '2rem' }}>
          Aggregate data from {data.facilityCount} ALRs reporting for {data.reportYear}. Use the charts below to explore staffing, occupancy, move-outs, and care trends.
        </p>

        <Section title="Residents by Month">
          <ChartWrapper>
            <LineChart data={data.residentsByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthShort" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Total Residents" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartWrapper>
        </Section>

        <Section title="Units Occupied by Month">
          <ChartWrapper>
            <LineChart data={data.unitsOccupiedByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthShort" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Units Occupied" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartWrapper>
        </Section>

        <Section title="Contracted Staff Hours by Month">
          <ChartWrapper>
            <LineChart data={data.contractedStaffHoursByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthShort" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Contracted Staff Hours" stroke="#9333ea" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartWrapper>
        </Section>

        <Section title="Residents Receiving Limited Medication Assistance (LMA) by Month">
          <ChartWrapper>
            <LineChart data={data.lmaByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthShort" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Residents Receiving LMA" stroke="#ea580c" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartWrapper>
        </Section>

        <Section title="Residents Receiving Skilled Care by Month">
          <ChartWrapper>
            <LineChart data={data.skilledCareByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthShort" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Residents Receiving Skilled Care" stroke="#dc2626" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartWrapper>
        </Section>

        <Section title="Move-Out Reasons">
          <ChartWrapper>
            <BarChart data={data.moveOutReasons} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="reason" width={180} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Residents" fill="#2563eb" />
            </BarChart>
          </ChartWrapper>
        </Section>

        <Section title="Duration of Residency">
          <ChartWrapper>
            <BarChart data={data.durationOfResidency} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="duration" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Residents" fill="#16a34a" />
            </BarChart>
          </ChartWrapper>
        </Section>

        <Section title="ADL Assistance">
          <ChartWrapper>
            <BarChart data={data.adlAssistance} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="adl" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Residents" fill="#9333ea" />
            </BarChart>
          </ChartWrapper>
        </Section>
      </main>
    </>
  )
}
