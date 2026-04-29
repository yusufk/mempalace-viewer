import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Line } from '@react-three/drei'
import * as THREE from 'three'

const B = '#4dc9f6'
const BD = '#0d3a5a'
const BG = '#00d4ff'
const BF = '#061828'
const FLOOR_H = 5

function WireLine({ points, color = BD, width = 1, opacity = 0.4 }) {
  return <Line points={points} color={color} lineWidth={width} transparent opacity={opacity} />
}

function WireRect({ pos, w, d, y = 0, color = BD, opacity = 0.3 }) {
  const hw = w / 2, hd = d / 2
  const pts = [
    [pos[0]-hw, y, pos[1]-hd], [pos[0]+hw, y, pos[1]-hd],
    [pos[0]+hw, y, pos[1]+hd], [pos[0]-hw, y, pos[1]+hd],
    [pos[0]-hw, y, pos[1]-hd],
  ]
  return <WireLine points={pts} color={color} opacity={opacity} />
}

function CurvedStaircase({ center, radius, startAngle, endAngle, steps = 16, y0 = 0, y1 = FLOOR_H }) {
  const rail = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const a = startAngle + (endAngle - startAngle) * t
      pts.push([center[0] + Math.cos(a) * radius, y0 + t * (y1 - y0), center[1] + Math.sin(a) * radius])
    }
    return pts
  }, [center, radius, startAngle, endAngle, y0, y1])

  const innerRail = useMemo(() => {
    const r2 = radius * 0.55
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const a = startAngle + (endAngle - startAngle) * t
      pts.push([center[0] + Math.cos(a) * r2, y0 + t * (y1 - y0), center[1] + Math.sin(a) * r2])
    }
    return pts
  }, [center, radius, startAngle, endAngle, y0, y1])

  const treads = useMemo(() => {
    const t = []
    const r2 = radius * 0.55
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps
      const a = startAngle + (endAngle - startAngle) * frac
      const y = y0 + frac * (y1 - y0)
      t.push([
        [center[0] + Math.cos(a) * r2, y, center[1] + Math.sin(a) * r2],
        [center[0] + Math.cos(a) * radius, y, center[1] + Math.sin(a) * radius],
      ])
    }
    return t
  }, [center, radius, startAngle, endAngle, steps, y0, y1])

  return (
    <group>
      <WireLine points={rail} color={B} width={1.5} opacity={0.7} />
      <WireLine points={innerRail} color={B} width={1} opacity={0.5} />
      {treads.map((pts, i) => <WireLine key={i} points={pts} color={BD} width={0.5} opacity={0.3} />)}
    </group>
  )
}

function Hallway({ from, to, y = 0, width = 2.5 }) {
  const dx = to[0] - from[0], dz = to[1] - from[1]
  const len = Math.sqrt(dx * dx + dz * dz)
  const nx = -dz / len * width / 2, nz = dx / len * width / 2
  return (
    <group>
      <WireLine points={[[from[0]+nx, y, from[1]+nz], [to[0]+nx, y, to[1]+nz]]} color={BD} opacity={0.35} />
      <WireLine points={[[from[0]-nx, y, from[1]-nz], [to[0]-nx, y, to[1]-nz]]} color={BD} opacity={0.35} />
      {Array.from({ length: Math.floor(len / 1.5) }, (_, i) => {
        const t = (i + 0.5) / Math.floor(len / 1.5)
        const x = from[0] + dx * t, z = from[1] + dz * t
        return <WireLine key={i} points={[[x+nx*0.3, y+0.01, z+nz*0.3], [x-nx*0.3, y+0.01, z-nz*0.3]]} color={BF} opacity={0.15} />
      })}
    </group>
  )
}

function RoomBox({ pos, w, d, h = 3, y = 0, label }) {
  const hw = w/2, hd = d/2, x = pos[0], z = pos[1]
  const walls = [
    [[x-hw,y,z-hd],[x-hw,y+h,z-hd],[x+hw,y+h,z-hd],[x+hw,y,z-hd]],
    [[x-hw,y,z+hd],[x-hw,y+h,z+hd],[x+hw,y+h,z+hd],[x+hw,y,z+hd]],
    [[x-hw,y,z-hd],[x-hw,y+h,z-hd],[x-hw,y+h,z+hd],[x-hw,y,z+hd]],
    [[x+hw,y,z-hd],[x+hw,y+h,z-hd],[x+hw,y+h,z+hd],[x+hw,y,z+hd]],
  ]
  return (
    <group>
      {/* Floor outline */}
      <WireRect pos={pos} w={w} d={d} y={y} color={B} opacity={0.5} />
      {/* Ceiling */}
      <WireRect pos={pos} w={w} d={d} y={y+h} color={BD} opacity={0.15} />
      {walls.map((pts, i) => <WireLine key={i} points={pts} color={BD} width={0.5} opacity={0.2} />)}
      {/* Room name on floor */}
      {label && (
        <Text position={[x, y + 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color={BD} anchorX="center" anchorY="middle">
          {label.replace(/_/g, ' ')}
        </Text>
      )}
    </group>
  )
}

function DrawerWall({ drawers, position, onDrawerClick, isSearch, activeId }) {
  const sp = 0.2
  const maxCols = 6   // X axis
  const maxRows = 6   // Z axis (depth — shelves)
  const perLayer = maxCols * maxRows
  return (
    <group position={position}>
      {drawers.map((d, i) => {
        const layer = Math.floor(i / perLayer)
        const inLayer = i % perLayer
        const col = inLayer % maxCols
        const row = Math.floor(inLayer / maxCols)
        return <DrawerCube key={d.id} position={[col * sp, layer * sp, row * sp]} drawer={d} onClick={onDrawerClick} isSearch={isSearch} activeId={activeId} />
      })}
    </group>
  )
}

function DrawerCube({ position, drawer, onClick, isSearch, activeId }) {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)
  const isActive = drawer.id === activeId
  const color = isActive ? '#4df6a6' : isSearch ? '#4df6a6' : B
  useFrame(() => {
    if (!ref.current) return
    const s = hovered ? 1.5 : isActive ? 1.8 : 1
    ref.current.scale.lerp(new THREE.Vector3(s, s, s), 0.15)
    ref.current.material.emissiveIntensity = THREE.MathUtils.lerp(ref.current.material.emissiveIntensity, isActive ? 2.5 : hovered ? 1.5 : 0.25, 0.1)
  })
  return (
    <mesh ref={ref} position={position} onClick={e => { e.stopPropagation(); onClick(drawer) }} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <boxGeometry args={[0.12, 0.12, 0.12]} />
      <meshStandardMaterial color={hovered ? '#fff' : color} emissive={color} emissiveIntensity={0.25} transparent opacity={hovered ? 0.95 : 0.65} wireframe={!hovered} />
    </mesh>
  )
}

/* ── Floor: foyer + hallways + wings + palace outline ── */
function Floor({ floorIndex, wings, grouped, onDrawerClick, isSearch, totalFloors, activeId }) {
  const y = floorIndex * FLOOR_H

  // Calculate palace extents based on rooms
  const maxRooms = Math.max(...wings.map(w => Object.keys(w.rooms).length), 1)
  const extent = 6 + (maxRooms - 1) * 5 + 2 // furthest room edge + margin
  const wallH = 3.5

  return (
    <group>
      {/* ── Palace outer walls ── */}
      {/* Front wall (with entrance gap on ground floor) */}
      {floorIndex === 0 ? (
        <>
          <WireLine points={[[-extent, y, 5], [-1.5, y, 5]]} color={B} width={1.5} opacity={0.5} />
          <WireLine points={[[1.5, y, 5], [extent, y, 5]]} color={B} width={1.5} opacity={0.5} />
          <WireLine points={[[-extent, y+wallH, 5], [extent, y+wallH, 5]]} color={B} width={1} opacity={0.3} />
          {/* Entrance columns */}
          <WireLine points={[[-1.5, y, 5], [-1.5, y+wallH, 5]]} color={BG} width={2} opacity={0.8} />
          <WireLine points={[[1.5, y, 5], [1.5, y+wallH, 5]]} color={BG} width={2} opacity={0.8} />
          {/* Arch */}
          <WireLine points={[[-1.5, y+wallH, 5], [0, y+wallH+0.8, 5], [1.5, y+wallH, 5]]} color={BG} width={1.5} opacity={0.6} />
          <Text position={[0, y+wallH+1.2, 5]} fontSize={0.25} color={BG} anchorX="center">ENTRANCE</Text>
        </>
      ) : (
        <>
          <WireLine points={[[-extent, y, 5], [extent, y, 5]]} color={B} width={1.5} opacity={0.5} />
          <WireLine points={[[-extent, y+wallH, 5], [extent, y+wallH, 5]]} color={B} width={1} opacity={0.3} />
        </>
      )}
      {/* Back wall */}
      <WireLine points={[[-extent, y, -extent], [extent, y, -extent]]} color={B} width={1.5} opacity={0.5} />
      <WireLine points={[[-extent, y+wallH, -extent], [extent, y+wallH, -extent]]} color={B} width={1} opacity={0.3} />
      {/* Left wall */}
      <WireLine points={[[-extent, y, 5], [-extent, y, -extent]]} color={B} width={1.5} opacity={0.5} />
      <WireLine points={[[-extent, y+wallH, 5], [-extent, y+wallH, -extent]]} color={B} width={1} opacity={0.3} />
      {/* Right wall */}
      <WireLine points={[[extent, y, 5], [extent, y, -extent]]} color={B} width={1.5} opacity={0.5} />
      <WireLine points={[[extent, y+wallH, 5], [extent, y+wallH, -extent]]} color={B} width={1} opacity={0.3} />
      {/* Corner pillars */}
      <WireLine points={[[-extent, y, 5], [-extent, y+wallH, 5]]} color={B} width={1} opacity={0.4} />
      <WireLine points={[[extent, y, 5], [extent, y+wallH, 5]]} color={B} width={1} opacity={0.4} />
      <WireLine points={[[-extent, y, -extent], [-extent, y+wallH, -extent]]} color={B} width={1} opacity={0.4} />
      <WireLine points={[[extent, y, -extent], [extent, y+wallH, -extent]]} color={B} width={1} opacity={0.4} />

      {/* ── Foyer ── */}
      <WireRect pos={[0, 0]} w={8} d={8} y={y} color={B} opacity={0.5} />
      {floorIndex === 0 ? (
        <Text position={[0, y + 0.02, 2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.6} color={BG} anchorX="center" letterSpacing={0.15}>
          MEMPALACE
        </Text>
      ) : (
        <Text position={[0, y + 0.02, 2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.4} color={BG} anchorX="center" letterSpacing={0.1}>
          {`FLOOR ${floorIndex + 1}`}
        </Text>
      )}

      {/* ── Staircases ── */}
      {floorIndex < totalFloors - 1 && (
        <>
          <CurvedStaircase center={[-3.5, 0]} radius={2.5} startAngle={Math.PI/2} endAngle={Math.PI*1.5} y0={y} y1={y + FLOOR_H} />
          <CurvedStaircase center={[3.5, 0]} radius={2.5} startAngle={Math.PI/2} endAngle={-Math.PI/2} y0={y} y1={y + FLOOR_H} />
        </>
      )}

      {/* ── Hallways ── */}
      {wings[0] && <Hallway from={[-4, 0]} to={[-20, 0]} y={y} />}
      {wings[1] && <Hallway from={[4, 0]} to={[20, 0]} y={y} />}
      {wings[2] && <Hallway from={[0, -4]} to={[0, -20]} y={y} />}

      {/* ── Wing labels ── */}
      {wings[0] && <Text position={[-5.5, y + 0.02, 1.5]} rotation={[-Math.PI/2,0,0]} fontSize={0.4} color="#f6a04d" anchorX="center" fontWeight="bold">{'▸ ' + wings[0].name.replace(/_/g,' ').toUpperCase()}</Text>}
      {wings[1] && <Text position={[5.5, y + 0.02, 1.5]} rotation={[-Math.PI/2,0,0]} fontSize={0.4} color="#f6a04d" anchorX="center" fontWeight="bold">{'▸ ' + wings[1].name.replace(/_/g,' ').toUpperCase()}</Text>}
      {wings[2] && <Text position={[0, y + 0.02, -5.5]} rotation={[-Math.PI/2,0,0]} fontSize={0.4} color="#f6a04d" anchorX="center" fontWeight="bold">{'▸ ' + wings[2].name.replace(/_/g,' ').toUpperCase()}</Text>}

      {/* ── Rooms ── */}
      {wings.map((wing, wi) => {
        const roomNames = Object.keys(wing.rooms)
        return roomNames.map((room, ri) => {
          let x, z
          if (wi === 0) { x = -6 - ri * 5; z = 0 }
          else if (wi === 1) { x = 6 + ri * 5; z = 0 }
          else { x = (ri % 2 === 0 ? -2.5 : 2.5); z = -6 - Math.floor(ri / 2) * 5 }

          const rd = grouped[`${wing.name}/${room}`] || []
          const layers = Math.ceil(rd.length / 36)
          const h = Math.max(2.5, layers * 0.2 + 1.5)
          return (
            <group key={`${wing.name}/${room}`}>
              <RoomBox pos={[x, z]} w={4} d={4} h={h} y={y} label={room} />
              <DrawerWall drawers={rd} position={[x - 1.3, y + 0.15, z - 1.3]} onDrawerClick={onDrawerClick} isSearch={isSearch} activeId={activeId} />
            </group>
          )
        })
      })}

      {/* ── Lights ── */}
      <pointLight position={[0, y + 4, 2]} intensity={0.6} color={BG} distance={25} />
      <pointLight position={[-12, y + 3, 0]} intensity={0.3} color="#0a4a6a" distance={20} />
      <pointLight position={[12, y + 3, 0]} intensity={0.3} color="#0a4a6a" distance={20} />
      <pointLight position={[0, y + 3, -12]} intensity={0.3} color="#0a4a6a" distance={20} />
    </group>
  )
}

/* ── Catmull-Rom curve helper ── */
function curvePoints(src, tgt, segments = 40) {
  const dx = tgt[0] - src[0], dz = tgt[2] - src[2]
  const dist = Math.sqrt(dx * dx + dz * dz)
  const height = Math.max(2, dist * 0.3)
  // Two control points for an organic S-curve
  const c1 = [src[0] + dx * 0.25 + dz * 0.15, src[1] + height * 0.7, src[2] + dz * 0.25 - dx * 0.15]
  const c2 = [src[0] + dx * 0.75 - dz * 0.15, tgt[1] + height, src[2] + dz * 0.75 + dx * 0.15]
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, t2 = t * t, t3 = t2 * t
    const h1 = 2*t3 - 3*t2 + 1, h2 = t3 - 2*t2 + t, h3 = -2*t3 + 3*t2, h4 = t3 - t2
    pts.push([
      h1*src[0] + h2*(c1[0]-src[0])*3 + h3*tgt[0] + h4*(tgt[0]-c2[0])*3,
      h1*src[1] + h2*(c1[1]-src[1])*3 + h3*tgt[1] + h4*(tgt[1]-c2[1])*3,
      h1*src[2] + h2*(c1[2]-src[2])*3 + h3*tgt[2] + h4*(tgt[2]-c2[2])*3,
    ])
  }
  return pts
}

/* ── Animated spark travelling along a filament ── */
function Spark({ points, speed = 1, color = '#f6a04d', delay = 0 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current || points.length < 2) return
    const t = ((clock.elapsedTime * speed + delay) % 2) / 2 // 0→1 loop
    const idx = Math.min(Math.floor(t * (points.length - 1)), points.length - 2)
    const frac = (t * (points.length - 1)) - idx
    const a = points[idx], b = points[idx + 1]
    ref.current.position.set(a[0] + (b[0]-a[0])*frac, a[1] + (b[1]-a[1])*frac, a[2] + (b[2]-a[2])*frac)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

/* ── Neuron-style connection lines between drawers ── */
function ConnectionLines({ connections, drawerPositions }) {
  if (!connections || !connections.similar || !drawerPositions) return null
  const srcPos = drawerPositions[connections.source.id]
  if (!srcPos) return null

  return (
    <group>
      {connections.similar.map((s, i) => {
        const tgtPos = drawerPositions[s.id]
        if (!tgtPos) return null
        const pts = curvePoints(srcPos, tgtPos)
        const strength = Math.max(0.3, 1 - s.distance * 0.6)
        return (
          <group key={i}>
            {/* Filament glow */}
            <Line points={pts} color="#f6a04d" lineWidth={1} transparent opacity={strength * 0.3} />
            <Line points={pts} color="#ffcc66" lineWidth={2} transparent opacity={strength * 0.6} />
            {/* Animated sparks */}
            <Spark points={pts} speed={0.4 + i * 0.1} color="#ffee88" delay={i * 0.3} />
            <Spark points={pts} speed={0.3 + i * 0.08} color="#f6a04d" delay={i * 0.3 + 1} />
            {/* Target node */}
            <mesh position={tgtPos}>
              <sphereGeometry args={[0.1]} />
              <meshBasicMaterial color="#f6a04d" transparent opacity={strength} />
            </mesh>
          </group>
        )
      })}
      {/* Source node removed — drawer itself glows */}
    </group>
  )
}

function MansionScene({ structure, drawers, onDrawerClick, connections }) {
  const grouped = useMemo(() => {
    const g = {}
    for (const d of drawers) {
      const key = `${d.wing}/${d.room}`
      ;(g[key] ||= []).push(d)
    }
    return g
  }, [drawers])

  const isSearch = drawers.length > 0 && drawers[0].distance !== undefined
  const wingNames = Object.keys(structure)

  const floors = useMemo(() => {
    const f = []
    for (let i = 0; i < wingNames.length; i += 3) {
      f.push(wingNames.slice(i, i + 3).map(name => ({ name, rooms: structure[name] })))
    }
    return f
  }, [wingNames, structure])

  // Build drawer ID → world position map
  const drawerPositions = useMemo(() => {
    const pos = {}
    const sp = 0.2, maxCols = 6, maxRows = 6, perLayer = maxCols * maxRows
    wingNames.forEach((wing, wi) => {
      const fi = Math.floor(wi / 3), wIdx = wi % 3, y = fi * FLOOR_H
      const roomNames = Object.keys(structure[wing] || {})
      roomNames.forEach((room, ri) => {
        let rx, rz
        if (wIdx === 0) { rx = -6 - ri * 5; rz = 0 }
        else if (wIdx === 1) { rx = 6 + ri * 5; rz = 0 }
        else { rx = (ri % 2 === 0 ? -2.5 : 2.5); rz = -6 - Math.floor(ri / 2) * 5 }
        const baseX = rx - 1.3, baseY = y + 0.15, baseZ = rz - 1.3
        const rd = grouped[`${wing}/${room}`] || []
        rd.forEach((d, i) => {
          const layer = Math.floor(i / perLayer)
          const inLayer = i % perLayer
          const col = inLayer % maxCols
          const row = Math.floor(inLayer / maxCols)
          pos[d.id] = [baseX + col * sp, baseY + layer * sp, baseZ + row * sp]
        })
      })
    })
    return pos
  }, [wingNames, structure, grouped])

  return (
    <>
      <ambientLight intensity={0.1} />
      <fog attach="fog" args={['#000000', 15, 60]} />

      {floors.map((wings, fi) => (
        <Floor key={fi} floorIndex={fi} wings={wings} grouped={grouped} onDrawerClick={onDrawerClick} isSearch={isSearch} totalFloors={floors.length} activeId={connections?.source?.id} />
      ))}

      <gridHelper args={[80, 80, '#071828', '#040e18']} position={[0, -0.02, 0]} />
      <ConnectionLines connections={connections} drawerPositions={drawerPositions} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={3} maxDistance={60} target={[0, (floors.length - 1) * FLOOR_H / 2, 0]} enablePan screenSpacePanning={false} panSpeed={1.5} rotateSpeed={0.8} mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }} />
    </>
  )
}

export default function PalaceView({ structure, selected, onSelect, drawers, onDrawerClick, connections }) {
  return (
    <Canvas camera={{ position: [0, 18, 25], fov: 50 }} gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => gl.setClearColor('#000000')}>
      <MansionScene structure={structure} drawers={drawers} onDrawerClick={onDrawerClick} connections={connections} />
    </Canvas>
  )
}
