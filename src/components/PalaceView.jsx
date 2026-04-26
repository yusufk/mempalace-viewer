import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Line, QuadraticBezierLine } from '@react-three/drei'
import * as THREE from 'three'

const B = '#4dc9f6'
const BD = '#0d3a5a'
const BG = '#00d4ff'
const BF = '#061828'

/* ── Blueprint line helpers ── */
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

/* ── Curved staircase ── */
function CurvedStaircase({ center, radius, startAngle, endAngle, steps = 16, y0 = 0, y1 = 3 }) {
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

/* ── Hallway ── */
function Hallway({ from, to, width = 2.5 }) {
  const dx = to[0] - from[0], dz = to[1] - from[1]
  const len = Math.sqrt(dx * dx + dz * dz)
  const nx = -dz / len * width / 2, nz = dx / len * width / 2

  return (
    <group>
      <WireLine points={[[from[0]+nx, 0, from[1]+nz], [to[0]+nx, 0, to[1]+nz]]} color={BD} opacity={0.35} />
      <WireLine points={[[from[0]-nx, 0, from[1]-nz], [to[0]-nx, 0, to[1]-nz]]} color={BD} opacity={0.35} />
      {/* Floor dashes */}
      {Array.from({ length: Math.floor(len / 1.5) }, (_, i) => {
        const t = (i + 0.5) / Math.floor(len / 1.5)
        const x = from[0] + dx * t, z = from[1] + dz * t
        return <WireLine key={i} points={[[x+nx*0.3, 0.01, z+nz*0.3], [x-nx*0.3, 0.01, z-nz*0.3]]} color={BF} opacity={0.15} />
      })}
    </group>
  )
}

/* ── Room box ── */
function RoomBox({ pos, w, d, h = 3, label }) {
  const hw = w/2, hd = d/2, x = pos[0], z = pos[1]
  const walls = [
    [[x-hw,0,z-hd],[x-hw,h,z-hd],[x+hw,h,z-hd],[x+hw,0,z-hd]],
    [[x-hw,0,z+hd],[x-hw,h,z+hd],[x+hw,h,z+hd],[x+hw,0,z+hd]],
    [[x-hw,0,z-hd],[x-hw,h,z-hd],[x-hw,h,z+hd],[x-hw,0,z+hd]],
    [[x+hw,0,z-hd],[x+hw,h,z-hd],[x+hw,h,z+hd],[x+hw,0,z+hd]],
  ]
  return (
    <group>
      <WireRect pos={pos} w={w} d={d} color={BD} opacity={0.35} />
      <WireRect pos={pos} w={w} d={d} y={h} color={BD} opacity={0.15} />
      {walls.map((pts, i) => <WireLine key={i} points={pts} color={BD} width={0.5} opacity={0.2} />)}
      {label && (
        <Text position={[x, h + 0.4, z]} fontSize={0.22} color={B} anchorX="center">
          {label.replace(/_/g, ' ')}
        </Text>
      )}
    </group>
  )
}

/* ── Drawer wall (Matrix gun rack style) ── */
function DrawerWall({ drawers, position, onDrawerClick, isSearch }) {
  const cols = Math.min(14, Math.ceil(Math.sqrt(drawers.length * 1.5)))
  const sp = 0.2
  return (
    <group position={position}>
      {drawers.map((d, i) => (
        <DrawerCube
          key={d.id}
          position={[(i % cols) * sp, Math.floor(i / cols) * sp, 0]}
          drawer={d}
          onClick={onDrawerClick}
          isSearch={isSearch}
        />
      ))}
    </group>
  )
}

function DrawerCube({ position, drawer, onClick, isSearch }) {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)
  const color = isSearch ? '#4df6a6' : B

  useFrame(() => {
    if (!ref.current) return
    const s = hovered ? 1.5 : 1
    ref.current.scale.lerp(new THREE.Vector3(s, s, s), 0.15)
    ref.current.material.emissiveIntensity = THREE.MathUtils.lerp(
      ref.current.material.emissiveIntensity, hovered ? 1.5 : 0.25, 0.1
    )
  })

  return (
    <mesh
      ref={ref} position={position}
      onClick={e => { e.stopPropagation(); onClick(drawer) }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[0.12, 0.12, 0.12]} />
      <meshStandardMaterial
        color={hovered ? '#fff' : color} emissive={color}
        emissiveIntensity={0.25} transparent opacity={hovered ? 0.95 : 0.65}
        wireframe={!hovered}
      />
    </mesh>
  )
}

/* ── Grand Foyer label ── */
function FoyerLabel() {
  return (
    <Text
      position={[0, 0.02, 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.6}
      color={BG}
      anchorX="center"
      letterSpacing={0.15}
    >
      MEMPALACE
    </Text>
  )
}

/* ── Main scene ── */
function MansionScene({ structure, drawers, selected, onDrawerClick }) {
  const grouped = useMemo(() => {
    const g = {}
    for (const d of drawers) {
      const key = `${d.wing}/${d.room}`
      if (!g[key]) g[key] = []
      g[key].push(d)
    }
    return g
  }, [drawers])

  const isSearch = drawers.length > 0 && drawers[0].distance !== undefined
  const wings = Object.keys(structure)

  // Mansion layout:
  // Foyer at center (0,0), front door at (0, 6)
  // Left hallway → wing 0 rooms along negative X
  // Right hallway → wing 1 rooms along positive X
  // Center hallway → wing 2 rooms along negative Z (back of mansion)
  const layout = useMemo(() => {
    const rooms = []
    wings.forEach((wing, wi) => {
      const roomNames = Object.keys(structure[wing] || {})
      roomNames.forEach((room, ri) => {
        let x, z
        if (wi % 3 === 0) {
          // Left wing — rooms along -X
          x = -6 - ri * 5
          z = 0
        } else if (wi % 3 === 1) {
          // Right wing — rooms along +X
          x = 6 + ri * 5
          z = 0
        } else {
          // Center/back wing — rooms along -Z
          x = (ri % 2 === 0 ? -2.5 : 2.5)
          z = -6 - Math.floor(ri / 2) * 5
        }
        rooms.push({ wing, room, x, z, drawers: grouped[`${wing}/${room}`] || [] })
      })
    })
    return rooms
  }, [wings, structure, grouped])

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 2]} intensity={0.6} color={BG} distance={25} />
      <pointLight position={[-12, 3, 0]} intensity={0.3} color="#0a4a6a" distance={20} />
      <pointLight position={[12, 3, 0]} intensity={0.3} color="#0a4a6a" distance={20} />
      <pointLight position={[0, 3, -12]} intensity={0.3} color="#0a4a6a" distance={20} />
      <fog attach="fog" args={['#000000', 10, 50]} />

      {/* Grand foyer */}
      <WireRect pos={[0, 0]} w={8} d={8} color={B} opacity={0.5} />
      <FoyerLabel />

      {/* Front door marker */}
      <WireLine points={[[-1.2, 0, 4], [-1.2, 2.8, 4]]} color={BG} width={2} opacity={0.8} />
      <WireLine points={[[1.2, 0, 4], [1.2, 2.8, 4]]} color={BG} width={2} opacity={0.8} />
      <WireLine points={[[-1.2, 2.8, 4], [0, 3.5, 4], [1.2, 2.8, 4]]} color={BG} width={1.5} opacity={0.6} />
      <Text position={[0, 3.8, 4]} fontSize={0.18} color={BD} anchorX="center">ENTRANCE</Text>

      {/* Curved staircases — left starts facing entrance (+Z), sweeps back; right mirrors */}
      <CurvedStaircase center={[-3.5, 0]} radius={2.5} startAngle={Math.PI/2} endAngle={Math.PI*1.5} />
      <CurvedStaircase center={[3.5, 0]} radius={2.5} startAngle={Math.PI/2} endAngle={-Math.PI/2} />

      {/* Second floor gallery (balcony outline) */}
      <WireRect pos={[0, 0]} w={8} d={3} y={3} color={B} opacity={0.25} />

      {/* Three hallways */}
      <Hallway from={[-4, 0]} to={[-20, 0]} />
      <Hallway from={[4, 0]} to={[20, 0]} />
      <Hallway from={[0, -4]} to={[0, -20]} />

      {/* Wing labels at hallway entrances */}
      {wings[0] && <Text position={[-5.5, 0.02, 1.5]} rotation={[-Math.PI/2,0,0]} fontSize={0.3} color={BG} anchorX="center">{wings[0].replace(/_/g,' ').toUpperCase()}</Text>}
      {wings[1] && <Text position={[5.5, 0.02, 1.5]} rotation={[-Math.PI/2,0,0]} fontSize={0.3} color={BG} anchorX="center">{wings[1].replace(/_/g,' ').toUpperCase()}</Text>}
      {wings[2] && <Text position={[0, 0.02, -5.5]} rotation={[-Math.PI/2,0,0]} fontSize={0.3} color={BG} anchorX="center">{wings[2].replace(/_/g,' ').toUpperCase()}</Text>}

      {/* Rooms */}
      {layout.map(({ wing, room, x, z, drawers: rd }) => {
        const h = Math.max(2.5, Math.ceil(rd.length / 14) * 0.2 + 1.5)
        return (
          <group key={`${wing}/${room}`}>
            <RoomBox pos={[x, z]} w={4} d={4} h={h} label={room} />
            <DrawerWall
              drawers={rd}
              position={[x - 1.3, 0.15, z - 1.3]}
              onDrawerClick={onDrawerClick}
              isSearch={isSearch}
            />
          </group>
        )
      })}

      {/* Blueprint grid floor */}
      <gridHelper args={[80, 80, '#071828', '#040e18']} position={[0, -0.02, 0]} />

      <OrbitControls
        makeDefault enableDamping dampingFactor={0.05}
        minDistance={3} maxDistance={40}
        target={[0, 1, 0]}
      />
    </>
  )
}

export default function PalaceView({ structure, selected, onSelect, drawers, onDrawerClick }) {
  return (
    <Canvas
      camera={{ position: [0, 18, 20], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => gl.setClearColor('#000000')}
    >
      <MansionScene
        structure={structure}
        drawers={drawers}
        selected={selected}
        onDrawerClick={onDrawerClick}
      />
    </Canvas>
  )
}
