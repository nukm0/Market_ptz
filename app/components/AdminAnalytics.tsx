"use client";
import {useEffect,useState} from "react";
import {ChartNoAxesCombined,RefreshCw,TrendingUp,Users,Package,Activity} from "lucide-react";
type Day={day:string;counts:Record<string,number>};
type Analytics={days:number;series:Day[];comparison:Record<string,{current:number;previous:number}>;totals:Record<string,number>;staff:{id:number;name:string;total:number}[]};
const metrics=[{key:"users",title:"Приход пользователей",hint:"Новые аккаунты площадки",icon:Users},{key:"bot",title:"Подписчики бота",hint:"Первый запуск бота",icon:Users},{key:"listings",title:"Новые объявления",hint:"Включая впоследствии удалённые",icon:Package},{key:"staff",title:"Работа администрации",hint:"Выполненные операции из журнала",icon:Activity},{key:"profile_subscriptions",title:"Подписки на профили",hint:"Новые подписки за день",icon:TrendingUp},{key:"shop_subscriptions",title:"Подписки на магазины",hint:"Новые подписки за день",icon:TrendingUp},{key:"views",title:"Просмотры объявлений",hint:"Зарегистрированные просмотры",icon:ChartNoAxesCombined},{key:"shops",title:"Новые магазины",hint:"Открытые витрины",icon:Package}];
const dateLabel=(day:string)=>new Date(day+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"short"});
function Chart({rows,metric}:{rows:Day[];metric:typeof metrics[number]}){
 const [selected,setSelected]=useState<number|null>(null);
 const values=rows.map(d=>d.counts[metric.key]||0),maximum=Math.max(1,...values),width=600,height=156;
 const x=(i:number)=>16+i*(width-32)/Math.max(1,rows.length-1),y=(v:number)=>height-12-v*(height-24)/maximum;
 const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(" "),index=selected===null?rows.length-1:Math.min(selected,rows.length-1);
 return <article className="growth-chart"><div className="growth-chart-title"><metric.icon size={18}/><div><h3>{metric.title}</h3><small>{metric.hint}</small></div><b>{values.reduce((a,b)=>a+b,0).toLocaleString("ru-RU")}</b></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.title}, максимум ${maximum} в день`}>
 {[0,.5,1].map(v=><line key={v} x1="16" x2={width-16} y1={y(v*maximum)} y2={y(v*maximum)} stroke="currentColor" opacity=".1"/>)}
 <polygon points={`16,${height-12} ${points} ${width-16},${height-12}`} fill="currentColor" opacity=".07"/>
 <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
 {values.map((v,i)=><circle key={i} cx={x(i)} cy={y(v)} r={selected===i?5:2} fill="currentColor"/>)}
 </svg><div className="growth-chart-axis"><span>{rows[0]&&dateLabel(rows[0].day)}</span><span>макс. {maximum}</span><span>{rows.length>0&&dateLabel(rows[rows.length-1].day)}</span></div>
 <label className="growth-day-picker">{rows[index]&&<span>{dateLabel(rows[index].day)} <b>{values[index]}</b></span>}<input aria-label={`Выбрать день: ${metric.title}`} type="range" min="0" max={Math.max(0,rows.length-1)} value={index} onChange={e=>setSelected(Number(e.target.value))}/></label></article>;
}
export default function AdminAnalytics(){
 const [days,setDays]=useState(30),[refresh,setRefresh]=useState(0),[data,setData]=useState<Analytics|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[table,setTable]=useState(false);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");setData(null);
 const initData=window.Telegram?.WebApp?.initData;
 if(!initData){setError("Откройте админ-панель через Telegram.");setLoading(false);return;}
 fetch("/api/admin/manage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"analytics",payload:{days}}),cache:"no-store",signal:controller.signal}).then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.error||"Не удалось загрузить статистику.");return json.result as Analytics;}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[days,refresh]);
 return <section className="growth-workspace"><header className="growth-heading"><div><span className="section-overline">ПУЛЬС ПЛОЩАДКИ</span><h3>Как растёт Marketplace</h3><p>Реальные данные · дни по московскому времени</p></div><button className="secondary-button compact" disabled={loading} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={15}/> Обновить</button></header><div className="growth-period" aria-label="Период статистики">{[7,30,90].map(n=><button key={n} aria-pressed={days===n} className={`filter-choice ${days===n?"selected":""}`} onClick={()=>setDays(n)}>{n} дней</button>)}</div>
 {loading&&<p role="status">Собираю статистику…</p>}{error&&<p role="alert">{error}</p>}
 {data&&<><div className="growth-kpis">{[["Пользователи",data.totals.users],["Запустили бота",data.totals.bot],["Активные объявления",data.totals.listings],["Открытые магазины",data.totals.shops],["Одобренные отзывы",data.totals.reviews],["Незакрытые жалобы",data.totals.pendingReports]].map(([label,value])=><article key={label}><small>{label}</small><b>{Number(value||0).toLocaleString("ru-RU")}</b></article>)}</div>
 <div className="growth-comparisons">{metrics.slice(0,4).map(m=>{const c=data.comparison[m.key]||{current:0,previous:0},change=c.current-c.previous;return <article key={m.key}><small>{m.title} · за период</small><div><b>{c.current}</b><span className={change>0?"growth-positive":change<0?"growth-negative":""}>{c.previous?`${change>0?"+":""}${Math.round(change/c.previous*100)}%`:c.current?`+${c.current}`:"Без изменений"}</span></div><small>Предыдущие {days} дней: {c.previous}</small></article>})}</div>
 <p className="form-hint">Сравнение с предыдущим периодом той же длины. Сегодняшний день ещё не завершён. Просмотр статистики не считается работой администрации.</p>
 <div className="growth-charts">{metrics.map(m=><Chart key={`${days}-${m.key}`} rows={data.series} metric={m}/>)}</div>
 <div className="permission-box"><h3>Работа команды за {days} дней</h3><p className="form-hint">Проверки объявлений, решения по жалобам и отзывам, управление площадкой. Поиск и просмотр списков не учитываются.</p>{data.staff.map((s,i)=><div className="growth-staff" key={s.id}><span>{i+1}</span><strong>{s.name}</strong><b>{s.total} операций</b></div>)}{!data.staff.length&&<p>За этот период действий пока нет.</p>}</div>
 <button className="secondary-button" aria-expanded={table} onClick={()=>setTable(v=>!v)}>{table?"Скрыть":"Показать"} данные по дням</button>{table&&<div className="growth-table-scroll"><table className="growth-table"><caption>Статистика по дням · Москва</caption><thead><tr><th>Дата</th>{metrics.map(m=><th key={m.key}>{m.title}</th>)}</tr></thead><tbody>{data.series.map(row=><tr key={row.day}><th>{dateLabel(row.day)}</th>{metrics.map(m=><td key={m.key}>{row.counts[m.key]||0}</td>)}</tr>)}</tbody></table></div>}
 <p className="form-hint">История восстановлена по сохранившимся записям. С 16 октября 2026 новые публикации и подписки сохраняются в статистике после удаления. Подписки показывают число оформлений, а не число уникальных людей; повторная подписка учитывается снова.</p></>}
 </section>;
}
