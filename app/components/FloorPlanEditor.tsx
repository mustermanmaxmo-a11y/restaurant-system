'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Restaurant, Table } from '@/types/database'
import { Map, X, UploadCloud, RefreshCw } from 'lucide-react'

interface Props {
  restaurant: Restaurant
  tables: Table[]
  onTablesUpdate: () => void
}

export default function FloorPlanEditor({ restaurant, tables, onTablesUpdate }: Props) {
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(restaurant.floor_plan_url)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // positions: overrides DB while dragging
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({})

  // which table is being dragged, and whether it came from the list (not yet placed)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingFromList, setDraggingFromList] = useState(false)

  // ghost position while dragging from list (percent relative to canvas)
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)

  // capacity editor
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [editCapacity, setEditCapacity] = useState(4)
  const [savingCapacity, setSavingCapacity] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const didMove = useRef(false)
  // store the last valid canvas pct position while dragging
  const lastCanvasPct = useRef<{ x: number; y: number } | null>(null)
  // use refs for drag state to avoid stale closures in event listeners
  const draggingIdRef = useRef<string | null>(null)
  const draggingFromListRef = useRef(false)

  function getPos(table: Table): { x: number; y: number } | null {
    if (localPos[table.id]) return localPos[table.id]
    if (table.position_x !== null && table.position_y !== null)
      return { x: table.position_x, y: table.position_y }
    return null
  }

  function toPct(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = (clientX - rect.left) / rect.width * 100
    const y = (clientY - rect.top) / rect.height * 100
    // only return valid pct if within canvas bounds (with small margin)
    if (x < -5 || x > 105 || y < -5 || y > 105) return null
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) }
  }

  // Global pointer move / up while dragging
  const handleGlobalMove = useCallback((e: PointerEvent) => {
    const id = draggingIdRef.current
    if (!id) return
    didMove.current = true
    const pct = toPct(e.clientX, e.clientY)
    if (draggingFromListRef.current) {
      if (pct) {
        lastCanvasPct.current = pct
        setGhostPos(pct)
      } else {
        setGhostPos(null)
      }
    } else {
      if (pct) {
        lastCanvasPct.current = pct
        setLocalPos(prev => ({ ...prev, [id]: pct }))
      }
    }
  }, [])

  const handleGlobalUp = useCallback(async () => {
    const id = draggingIdRef.current
    if (!id) return
    const moved = didMove.current
    const fromList = draggingFromListRef.current
    const pos = lastCanvasPct.current

    // reset refs immediately
    draggingIdRef.current = null
    draggingFromListRef.current = false
    lastCanvasPct.current = null
    didMove.current = false

    if (fromList) {
      setGhostPos(null)
      setDraggingId(null)
      setDraggingFromList(false)
      if (pos) {
        await supabase.from('tables').update({ position_x: pos.x, position_y: pos.y }).eq('id', id)
        onTablesUpdate()
      }
    } else {
      if (moved && pos) {
        setDraggingId(null)
        setLocalPos(prev => { const n = { ...prev }; delete n[id]; return n })
        await supabase.from('tables').update({ position_x: pos.x, position_y: pos.y }).eq('id', id)
        onTablesUpdate()
      } else if (!moved) {
        setDraggingId(null)
        setLocalPos(prev => { const n = { ...prev }; delete n[id]; return n })
        const table = tables.find(t => t.id === id)
        if (table) { setEditingTable(table); setEditCapacity(table.capacity ?? 4) }
      } else {
        setDraggingId(null)
      }
    }
  }, [tables, onTablesUpdate])

  useEffect(() => {
    if (!draggingId) return
    window.addEventListener('pointermove', handleGlobalMove)
    window.addEventListener('pointerup', handleGlobalUp)
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove)
      window.removeEventListener('pointerup', handleGlobalUp)
    }
  }, [draggingId, handleGlobalMove, handleGlobalUp])

  function startDragPlaced(e: React.PointerEvent, tableId: string) {
    e.preventDefault()
    e.stopPropagation()
    didMove.current = false
    lastCanvasPct.current = null
    draggingIdRef.current = tableId
    draggingFromListRef.current = false
    setDraggingId(tableId)
    setDraggingFromList(false)
  }

  function startDragFromList(e: React.PointerEvent, tableId: string) {
    e.preventDefault()
    didMove.current = false
    lastCanvasPct.current = null
    draggingIdRef.current = tableId
    draggingFromListRef.current = true
    setDraggingId(tableId)
    setDraggingFromList(true)
    setGhostPos(null)
  }

  async function removeFromPlan(tableId: string) {
    await supabase.from('tables').update({ position_x: null, position_y: null }).eq('id', tableId)
    setLocalPos(prev => { const n = { ...prev }; delete n[tableId]; return n })
    onTablesUpdate()
  }

  async function saveCapacity() {
    if (!editingTable) return
    setSavingCapacity(true)
    await supabase.from('tables').update({ capacity: editCapacity }).eq('id', editingTable.id)
    onTablesUpdate()
    setSavingCapacity(false)
    setEditingTable(null)
  }

  async function uploadFloorPlan(file: File) {
    setUploading(true)
    setUploadError('')
    const ext = file.name.split('.').pop()
    const path = `${restaurant.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('floor-plans').upload(path, file, { upsert: true })
    if (error) { setUploadError(`Upload fehlgeschlagen: ${error.message}`); setUploading(false); return }
    const { data } = supabase.storage.from('floor-plans').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('restaurants').update({ floor_plan_url: data.publicUrl }).eq('id', restaurant.id)
    if (dbErr) { setUploadError(`DB-Fehler: ${dbErr.message}`) } else { setFloorPlanUrl(data.publicUrl) }
    setUploading(false)
  }

  const placedTables = tables.filter(t => getPos(t) !== null && t.id !== (draggingFromList ? draggingId : null))
  const unplacedTables = tables.filter(t => getPos(t) === null)

  // ghost table info
  const ghostTable = draggingFromList && draggingId ? tables.find(t => t.id === draggingId) : null

  return (
    <div style={{ padding: '24px' }}>
      {/* Upload */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>
          Lade einen Grundriss hoch (PNG, JPG). Ziehe dann die Tische von unten auf den Grundriss.
        </p>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'var(--accent)', color: '#fff', borderRadius: '8px',
          padding: '8px 18px', fontWeight: 600, fontSize: '0.875rem',
          cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1,
        }}>
          {uploading ? 'Wird hochgeladen...' : floorPlanUrl ? <><RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Grundriss ersetzen</> : <><UploadCloud size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Grundriss hochladen</>}
          <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" style={{ display: 'none' }}
            disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFloorPlan(f) }} />
        </label>
        {uploadError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px' }}>{uploadError}</p>}
      </div>

      {!floorPlanUrl ? (
        <div style={{ background: 'var(--surface)', border: '2px dashed var(--border)', borderRadius: '12px', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><Map size={48} color="var(--text-muted)" /></div>
          <p style={{ color: 'var(--text-muted)' }}>Noch kein Grundriss hochgeladen.</p>
        </div>
      ) : (
        <>
          {/* Canvas */}
          <div
            ref={containerRef}
            style={{
              position: 'relative', width: '100%', borderRadius: '12px',
              overflow: 'hidden', border: '1px solid var(--border)',
              userSelect: 'none', touchAction: 'none',
              cursor: draggingFromList && ghostPos ? 'copy' : 'default',
            }}
          >
            <img src={floorPlanUrl} alt="Grundriss"
              style={{ width: '100%', display: 'block', pointerEvents: 'none' }} draggable={false} />

            {/* Placed markers */}
            {placedTables.map(table => {
              const pos = getPos(table)!
              const isDragging = draggingId === table.id && !draggingFromList
              return (
                <TableMarker
                  key={table.id}
                  table={table}
                  pos={pos}
                  isDragging={isDragging}
                  onPointerDown={e => startDragPlaced(e, table.id)}
                  onRemove={() => removeFromPlan(table.id)}
                />
              )
            })}

            {/* Ghost marker while dragging from list */}
            {ghostTable && ghostPos && (
              <div style={{
                position: 'absolute',
                left: `${ghostPos.x}%`, top: `${ghostPos.y}%`,
                transform: 'translate(-50%, -50%)',
                width: '38px', height: '38px', borderRadius: '50%',
                background: 'var(--accent)', opacity: 0.7,
                border: '2.5px dashed #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '0.7rem',
                pointerEvents: 'none', zIndex: 20,
              }}>
                {ghostTable.table_num}
              </div>
            )}

            {/* Drop hint overlay */}
            {draggingFromList && (
              <div style={{
                position: 'absolute', inset: 0,
                background: ghostPos ? 'rgba(108,99,255,0.06)' : 'rgba(108,99,255,0.03)',
                border: ghostPos ? '2px solid var(--accent)' : '2px dashed var(--border)',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
                transition: 'all 0.15s',
              }}>
                {!ghostPos && (
                  <div style={{ background: 'var(--surface)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    Hier loslassen zum Platzieren
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Capacity editor */}
          {editingTable && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
              onClick={() => setEditingTable(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px 28px', minWidth: '240px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>{editingTable.label}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Kapazität (Personen)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <button onClick={() => setEditCapacity(c => Math.max(1, c - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--surface-2)', border: 'none', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}>−</button>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.3rem', minWidth: '32px', textAlign: 'center' }}>{editCapacity}</span>
                  <button onClick={() => setEditCapacity(c => Math.min(30, c + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setEditingTable(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Abbrechen</button>
                  <button onClick={saveCapacity} disabled={savingCapacity} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: savingCapacity ? 0.7 : 1 }}>
                    {savingCapacity ? '...' : 'Speichern'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unplaced tables — drag onto canvas */}
          {unplacedTables.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Tisch auf den Grundriss ziehen ↑
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {unplacedTables.map(table => (
                  <div
                    key={table.id}
                    onPointerDown={e => startDragFromList(e, table.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 14px', borderRadius: '8px',
                      border: `1.5px solid ${draggingId === table.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: draggingId === table.id ? 'var(--accent-subtle)' : 'var(--surface)',
                      cursor: 'grab', userSelect: 'none', touchAction: 'none',
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'var(--accent)', opacity: draggingId === table.id ? 0.4 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '0.7rem',
                    }}>
                      {table.table_num}
                    </div>
                    <span style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600 }}>{table.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{table.capacity} P.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {placedTables.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '14px' }}>
              Tisch ziehen = verschieben · Tisch anklicken = Kapazität bearbeiten · X = entfernen
            </p>
          )}
        </>
      )}
    </div>
  )
}

function TableMarker({ table, pos, isDragging, onPointerDown, onRemove }: {
  table: Table
  pos: { x: number; y: number }
  isDragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onRemove: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: `${pos.x}%`, top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        width: '38px', height: '38px', borderRadius: '50%',
        background: isDragging ? 'var(--accent-hover, #5a52e0)' : 'var(--accent)',
        border: '2.5px solid #fff',
        boxShadow: isDragging ? '0 6px 20px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: '0.7rem',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 30 : 10,
        touchAction: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.15s',
      }}
      title={`${table.label} · ${table.capacity} Plätze — ziehen zum Verschieben, klicken zum Bearbeiten`}
    >
      {table.table_num}
      {hovered && !isDragging && (
        <div
          onClick={e => { e.stopPropagation(); onRemove() }}
          onPointerDown={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: '-8px', right: '-8px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: '#ef4444', border: '1.5px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 40, color: '#fff',
          }}
        ><X size={10} /></div>
      )}
    </div>
  )
}
