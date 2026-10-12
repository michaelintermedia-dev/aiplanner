import type { AiUsageTotals } from '@shared/types'
import { t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { adminApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'

const PERIODS = [
  { days: 7, label: () => t('admin.last7') },
  { days: 30, label: () => t('admin.last30') },
  { days: 90, label: () => t('admin.last90') },
]

/**
 * The operator's AI cost report (accounts in the server's Admin:Emails only):
 * what the AI cost in total, per user and per day - to know what a user costs
 * before setting prices. Web only: an operator tool, not part of the app.
 */
export function AdminUsagePage() {
  const { user, zone } = useAuth()
  const [days, setDays] = useState(30)
  const report = useQuery({ queryKey: ['admin', 'ai-usage', days], queryFn: () => adminApi.aiUsage(days), enabled: !!user?.isAdmin })
  if (user && !user.isAdmin) return <Navigate to="/settings" replace />

  const money = (usd: number) =>
    new Intl.NumberFormat(zone.locale, { style: 'currency', currency: 'USD', maximumFractionDigits: usd !== 0 && Math.abs(usd) < 1 ? 4 : 2 }).format(usd)
  const num = (n: number) => new Intl.NumberFormat(zone.locale).format(n)
  const data = report.data

  return (
    <div className="page wide admin-usage">
      <header className="page-header">
        <h1>{t('admin.aiCosts')}</h1>
        <div className="toolbar">
          <div className="segmented">
            {PERIODS.map((p) => (
              <button key={p.days} className={days === p.days ? 'active' : undefined} onClick={() => setDays(p.days)}>
                {p.label()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {report.isPending && <p className="muted">{t('common.loading')}</p>}
      {report.error && <p className="error">{report.error.message}</p>}
      {data && (
        <>
          <section className="card admin-totals">
            <Stat label={t('admin.total')} value={money(data.total.costUsd)} strong />
            <Stat label={t('admin.perMonth')} value={money((data.total.costUsd / data.days) * 30)} />
            <Stat label={t('admin.messages')} value={num(data.total.messages)} />
            <Stat label={t('admin.perMessage')} value={data.total.messages ? money(data.total.costUsd / data.total.messages) : '-'} />
            <Stat label={t('admin.transcriptions')} value={num(data.total.transcriptions)} />
            <Stat label={t('admin.descriptions')} value={num(data.total.mediaDescriptions)} />
          </section>

          {data.unpricedModels.length > 0 && <p className="error">{t('admin.unpriced', { models: data.unpricedModels.join(', ') })}</p>}

          {data.total.calls === 0 ? (
            <p className="muted">{t('admin.empty')}</p>
          ) : (
            <>
              <section className="card">
                <h3>{t('admin.users')}</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th />
                        <th>{t('admin.cost')}</th>
                        <th>{t('admin.perMonth')}</th>
                        <th>{t('admin.messages')}</th>
                        <th>{t('admin.perMessage')}</th>
                        <th>{t('admin.activeDays')}</th>
                        <th>{t('admin.tokens')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => (
                        <tr key={u.userId ?? 'unknown'}>
                          <td>
                            <strong>{u.displayName ?? t('admin.unknownUser')}</strong>
                            {u.email && <div className="muted small">{u.email}</div>}
                          </td>
                          <td>{money(u.totals.costUsd)}</td>
                          <td>{money((u.totals.costUsd / data.days) * 30)}</td>
                          <td>{num(u.totals.messages)}</td>
                          <td>{u.costPerMessageUsd === null ? '-' : money(u.costPerMessageUsd)}</td>
                          <td>{num(u.activeDays)}</td>
                          <td>{tokens(u.totals, num)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <h3>{t('admin.perDay')}</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th />
                        <th>{t('admin.cost')}</th>
                        <th>{t('admin.messages')}</th>
                        <th>{t('admin.calls')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.perDay].reverse().map((d) => (
                        <tr key={d.date}>
                          <td>{new Date(`${d.date}T12:00:00Z`).toLocaleDateString(zone.locale, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                          <td>{money(d.costUsd)}</td>
                          <td>{num(d.messages)}</td>
                          <td>{num(d.calls)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          <p className="muted small">
            {t('admin.pricesNote', {
              date: new Date(`${data.perDay[0]?.date ?? data.fromUtc.slice(0, 10)}T12:00:00Z`).toLocaleDateString(zone.locale, { month: 'short', day: 'numeric' }),
            })}
          </p>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="admin-stat">
      <span className="muted small">{label}</span>
      {strong ? <strong className="admin-stat-big">{value}</strong> : <span className="admin-stat-value">{value}</span>}
    </div>
  )
}

const tokens = (x: AiUsageTotals, num: (n: number) => string) => `${num(x.inputTokens)} / ${num(x.outputTokens)}`
