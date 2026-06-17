import React, { useEffect, useRef, useState } from 'react';
import { Layers, HelpCircle, RefreshCw, Activity, MapPin } from 'lucide-react';
import mapJson from './assets/map_decoded.json';

// Types matching the map JSON structure
interface NodeDoor {
  code: string;
  dir: boolean;
  enable: boolean;
  no: number;
  type: number;
}

interface NodeLine {
  belongNodeId: number;
  door: NodeDoor;
  highPrecision: boolean;
  len: number;
  linkNodeId: number;
  maxHeight: number;
  maxNoLoadVelocity: number;
  maxVelocity: number;
  maxWidth: number;
  obsLimitEnable: number;
  obsLimitHeight: number;
  obsLimitLength: number;
  obsLimitWidth: number;
  obsLoadLimitHeight: number;
  obsLoadLimitLength: number;
  obsLoadLimitWidth: number;
  podAngle: number;
  turn: boolean;
  type: number;
}

interface RemarkNode {
  color: string;
  content: string;
  position: [number, number];
  remarkHeight: number;
  remarkWidth: number;
  size: number;
  verticalMode: boolean;
  weight: number;
}

interface MapNode {
  areaId: number;
  avoid: number;
  calibration: boolean;
  code: string;
  highPrecision: boolean;
  id: number;
  line: NodeLine[];
  offsetX: number;
  offsetY: number;
  parkAngle: number;
  pickDir?: number;
  podAngle: number;
  podTurnAllow: boolean;
  position: [number, number];
  stayAllow: boolean;
  trayAngle: number;
  trayTurnAllow: boolean;
  turnAllow: boolean;
  type: number;
}

interface Edge {
  from: number;
  to: number;
}

export default function App() {
  const [showLabels, setShowLabels] = useState(true);
  const [showIds, setShowIds] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const [zoomVal, setZoomVal] = useState('100%');
  const [coordX, setCoordX] = useState<string>('—');
  const [coordY, setCoordY] = useState<string>('—');

  // Tooltip state
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Map Data
  const nodes: MapNode[] = mapJson.staticArea as MapNode[];
  const remarks: RemarkNode[] = mapJson.fontRemark as RemarkNode[];

  // Edges extraction
  const [edges, setEdges] = useState<Edge[]>([]);
  const [nodeMap, setNodeMap] = useState<Record<number, MapNode>>({});

  // Stats
  const [stats, setStats] = useState({
    totalNodes: 0,
    pathNodes: 0,
    stations: 0,
    edgesCount: 0,
    labelsCount: 0,
  });

  // Limits
  const [limits, setLimits] = useState({
    minX: 0, maxX: 0, minY: 0, maxY: 0, dataW: 0, dataH: 0
  });

  // Transform View State Refs (to avoid triggering React rerender on drag/pan/zoom)
  const viewState = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    offsetStart: { x: 0, y: 0 }
  });

  // Preload Images
  const imgHighspeedRef = useRef<HTMLImageElement | null>(null);
  const imgShelvesRef = useRef<HTMLImageElement | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    // Calc stats
    const edgeSet = new Set<string>();
    const tempEdges: Edge[] = [];
    const tempNodeMap: Record<number, MapNode> = {};

    for (const node of nodes) {
      tempNodeMap[node.id] = node;
      for (const line of (node.line || [])) {
        const a = node.id;
        const b = line.linkNodeId;
        const key = Math.min(a, b) + '-' + Math.max(a, b);
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          tempEdges.push({ from: a, to: b });
        }
      }
    }

    setEdges(tempEdges);
    setNodeMap(tempNodeMap);

    const type1 = nodes.filter(n => n.type === 1).length;
    const type8 = nodes.filter(n => n.type === 8).length;

    setStats({
      totalNodes: nodes.length,
      pathNodes: type1,
      stations: type8,
      edgesCount: tempEdges.length,
      labelsCount: remarks.length
    });

    const xs = nodes.map(n => n.position[0]);
    const ys = nodes.map(n => n.position[1]);
    const minX = Math.min(...xs) - 3;
    const maxX = Math.max(...xs) + 3;
    const minY = Math.min(...ys) - 3;
    const maxY = Math.max(...ys) + 3;
    const dataW = maxX - minX;
    const dataH = maxY - minY;

    setLimits({ minX, maxX, minY, maxY, dataW, dataH });

    // Load Images
    const imgHighspeed = new Image();
    const imgShelves = new Image();
    imgHighspeed.src = '/lattice-highspeed.png';
    imgShelves.src = '/lattice-shelves.png';
    let loaded = 0;
    const onImgLoad = () => {
      loaded++;
      if (loaded === 2) {
        setImagesLoaded(true);
      }
    };
    imgHighspeed.onload = onImgLoad;
    imgShelves.onload = onImgLoad;
    imgHighspeedRef.current = imgHighspeed;
    imgShelvesRef.current = imgShelves;

    // Fetch call on mount (corresponds to proxy call)
    fetch('/rest/pods', {
      method: 'POST',
      headers: {
        authorization: 'mrbase64 mrrest:YWRtaW4mYWRtaW4=',
        token: 'root:eyJhbGciOiJIUzI1NiJ9.eyJjbGllbnRUeXBlIjoiIiwicm9sZUNvZGVzIjoiIiwidXNlckNvZGUiOiJyb290IiwiaWF0IjoxNzgxNjYzMzU2LCJleHAiOjE3ODE2NzY5MzR9.9HkdQHh3DsvnFKP5cCOHHp5aSlt3LQ5hDWd-WLH15CY',
        userName: 'root',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mapCode: 'DI', floorCode: '' })
    }).then(res => res.json())
      .then(data => console.log('Pods details fetched successfully:', data))
      .catch(err => console.warn('Could not fetch real-time pod details, using offline/fallback modes.', err));

  }, []);

  // Map to screen space and screen to map space functions
  const toScreen = (mx: number, my: number) => {
    const { offsetX, offsetY, scale } = viewState.current;
    return [
      offsetX + mx * scale,
      offsetY + (limits.maxY - my + limits.minY) * scale
    ];
  };

  const toMap = (sx: number, sy: number) => {
    const { offsetX, offsetY, scale } = viewState.current;
    return [
      (sx - offsetX) / scale,
      limits.maxY - (sy - offsetY) / scale + limits.minY
    ];
  };

  const updateZoomLabel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base = Math.min(canvas.width / limits.dataW, canvas.height / limits.dataH) * 0.85;
    setZoomVal(Math.round(viewState.current.scale / base * 100) + '%');
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      const step = 5;
      const sx0 = Math.ceil(limits.minX / step) * step;
      const sy0 = Math.ceil(limits.minY / step) * step;

      for (let mx = sx0; mx <= limits.maxX; mx += step) {
        const [px] = toScreen(mx, 0);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, H);
        ctx.stroke();
      }
      for (let my = sy0; my <= limits.maxY; my += step) {
        const [, py] = toScreen(0, my);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(W, py);
        ctx.stroke();
      }
    }

    // Draw Edges
    for (const e of edges) {
      const na = nodeMap[e.from];
      const nb = nodeMap[e.to];
      if (!na || !nb) continue;
      const [ax, ay] = toScreen(na.position[0], na.position[1]);
      const [bx, by] = toScreen(nb.position[0], nb.position[1]);
      const isSt = na.type === 8 || nb.type === 8;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      if (isSt) {
        ctx.strokeStyle = 'rgba(245,158,11,0.55)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = 'rgba(51,65,85,0.9)';
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // Draw Nodes
    const r = Math.max(3.5, Math.min(10, viewState.current.scale * 0.6));
    const imgHighspeed = imgHighspeedRef.current;
    const imgShelves = imgShelvesRef.current;

    for (const node of nodes) {
      const [sx, sy] = toScreen(node.position[0], node.position[1]);
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

      if (node.stayAllow) {
        // Stay-Allow: green circle
        const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r);
        g.addColorStop(0, '#6ee7b7');
        g.addColorStop(1, '#065f46');
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (node.type === 8) {
        // Station: shelves image
        const size = r * 2.6;
        if (imgShelves && imgShelves.complete && imgShelves.naturalWidth > 0) {
          ctx.drawImage(imgShelves, sx - size / 2, sy - size / 2, size, size);
        } else {
          // fallback diamond
          ctx.beginPath();
          ctx.moveTo(sx, sy - r);
          ctx.lineTo(sx + r, sy);
          ctx.lineTo(sx, sy + r);
          ctx.lineTo(sx - r, sy);
          ctx.closePath();
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
        }
      } else {
        // Path node: highspeed image
        const size = r * 2.4;
        if (imgHighspeed && imgHighspeed.complete && imgHighspeed.naturalWidth > 0) {
          ctx.drawImage(imgHighspeed, sx - size / 2, sy - size / 2, size, size);
        } else {
          // fallback circle
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fillStyle = '#00d4ff';
          ctx.fill();
        }
      }

      // Draw highlighted node if hovered
      if (hoveredNode && hoveredNode.id === node.id) {
        const haloR = node.type === 8 ? r * 1.15 + 5 : r + 5;
        ctx.beginPath();
        ctx.arc(sx, sy, haloR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, haloR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Node ID
      if (showIds && viewState.current.scale > 9) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.font = `600 ${Math.max(6, r * 0.8)}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id.toString(), sx, sy);
      }
    }

    // Text remarks
    if (showLabels) {
      for (const rm of remarks) {
        const [sx, sy] = toScreen(rm.position[0], rm.position[1]);
        const fs = Math.max(10, rm.size * viewState.current.scale * 0.042);
        ctx.font = `${rm.weight} ${fs}px Inter, sans-serif`;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillStyle = rm.color || '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        if (rm.verticalMode) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(rm.content, 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(rm.content, sx, sy);
        }
        ctx.shadowBlur = 0;
      }
    }
  };

  const resetView = () => {
    const canvas = canvasRef.current;
    if (!canvas || limits.dataW === 0) return;
    const W = canvas.width;
    const H = canvas.height;
    const fit = Math.min(W / limits.dataW, H / limits.dataH) * 0.85;
    viewState.current.scale = fit;
    viewState.current.offsetX = (W - limits.dataW * fit) / 2 - limits.minX * fit;
    viewState.current.offsetY = (H - limits.dataH * fit) / 2 - limits.minY * fit;
    updateZoomLabel();
    draw();
  };

  const handleResize = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    draw();
  };

  // Trigger redraw on state options changes
  useEffect(() => {
    draw();
  }, [showLabels, showIds, showGrid, hoveredNode, imagesLoaded, limits]);

  // Set up resize observer
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(wrap);
    setTimeout(resetView, 100);
    return () => observer.disconnect();
  }, [limits]);

  // Mouse / Touch Event Handlers
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (viewState.current.isDragging) {
      viewState.current.offsetX = viewState.current.offsetStart.x + (e.clientX - viewState.current.dragStart.x);
      viewState.current.offsetY = viewState.current.offsetStart.y + (e.clientY - viewState.current.dragStart.y);
      draw();
      return;
    }

    const [mx, my] = toMap(sx, sy);
    setCoordX(mx.toFixed(2));
    setCoordY(my.toFixed(2));

    // Hover check
    const thresh = Math.max(10, 1.5) / viewState.current.scale;
    let best: MapNode | null = null;
    let bestD = Infinity;

    for (const n of nodes) {
      const dx = n.position[0] - mx;
      const dy = n.position[1] - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < thresh && d < bestD) {
        best = n;
        bestD = d;
      }
    }

    if (best !== hoveredNode) {
      setHoveredNode(best);
    }

    if (best) {
      let tx = e.clientX + 16;
      let ty = e.clientY - 16;
      if (tx + 230 > window.innerWidth) tx = e.clientX - 246;
      if (ty + 160 > window.innerHeight) ty = e.clientY - 160;
      setTooltipPos({ x: tx, y: ty });
    }
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    viewState.current.isDragging = true;
    viewState.current.dragStart = { x: e.clientX, y: e.clientY };
    viewState.current.offsetStart = { x: viewState.current.offsetX, y: viewState.current.offsetY };
  };

  const onMouseUp = () => {
    viewState.current.isDragging = false;
  };

  const onMouseLeave = () => {
    viewState.current.isDragging = false;
    setHoveredNode(null);
    setCoordX('—');
    setCoordY('—');
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;

    viewState.current.offsetX = mx - (mx - viewState.current.offsetX) * f;
    viewState.current.offsetY = my - (my - viewState.current.offsetY) * f;
    viewState.current.scale *= f;

    updateZoomLabel();
    draw();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ─── Header ─── */}
      <header>
        <div className="header-logo">
          <div className="icon">⬡</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1>PD4 Diecast</h1>
              <span className="badge badge-cyan">DI</span>
              <span className="badge badge-purple">topoMap</span>
            </div>
            <div className="sub">AMR Topology Map Viewer &nbsp;·&nbsp; Org: {mapJson.orgName}</div>
          </div>
        </div>

        <div className="header-sep"></div>

        <div className="header-controls">
          <button
            className={`toggle-btn ${showLabels ? 'active' : ''}`}
            onClick={() => setShowLabels(!showLabels)}
          >
            <Layers size={12} />
            Labels
          </button>
          <button
            className={`toggle-btn ${showIds ? 'active' : ''}`}
            onClick={() => setShowIds(!showIds)}
          >
            <MapPin size={12} />
            Node IDs
          </button>
          <button
            className={`toggle-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
          >
            <Activity size={12} />
            Grid
          </button>
          <div className="header-sep"></div>
          <button className="btn-reset" onClick={resetView}>
            <RefreshCw size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
            Reset
          </button>
        </div>
      </header>

      {/* ─── Main layout ─── */}
      <div className="main-layout">
        <div
          id="canvas-wrap"
          ref={wrapRef}
          className={viewState.current.isDragging ? 'dragging' : ''}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onWheel={onWheel}
            style={{ width: '100%', height: '100%' }}
          />

          <div className="hud hud-zoom">
            <HelpCircle size={12} />
            <span className="zval">{zoomVal}</span>
          </div>

          <div className="hud hud-coords">
            x: <span className="cval">{coordX}</span> &nbsp; y: <span className="cval">{coordY}</span>
          </div>
        </div>

        {/* ─── Sidebar ─── */}
        <div className="sidebar">
          <div className="sidebar-section">
            <div className="section-label">Statistics</div>
            <div className="stat-grid">
              <div className="stat-card full">
                <div className="s-num">{stats.totalNodes}</div>
                <div className="s-lbl">Total Nodes</div>
              </div>
              <div className="stat-card">
                <div className="s-num">{stats.pathNodes}</div>
                <div className="s-lbl">Path Nodes</div>
              </div>
              <div className="stat-card">
                <div className="s-num">{stats.stations}</div>
                <div className="s-lbl">Stations</div>
              </div>
              <div className="stat-card">
                <div className="s-num">{stats.edgesCount}</div>
                <div className="s-lbl">Edges</div>
              </div>
              <div className="stat-card">
                <div className="s-num">{stats.labelsCount}</div>
                <div className="s-lbl">Labels</div>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">Legend</div>
            <div className="legend-list">
              <div className="legend-item"><div className="l-dot l-path"></div> Path Node (type 1)</div>
              <div className="legend-item"><div className="l-dot l-station"></div> Station Node (type 8)</div>
              <div className="legend-item"><div className="l-dot l-stay"></div> Stay-Allow Node</div>
              <div className="legend-item"><div className="l-line l-edge"></div> Path Edge</div>
              <div className="legend-item"><div className="l-line l-edge-st"></div> Station Edge</div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">Controls</div>
            <div className="tip-list">
              <div className="tip-item"><span className="tip-key">Scroll</span> Zoom in / out</div>
              <div className="tip-item"><span className="tip-key">Drag</span> Pan the map</div>
              <div className="tip-item"><span className="tip-key">Hover</span> Node details</div>
              <div className="tip-item"><span className="tip-key">↺</span> Reset view</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tooltip ─── */}
      {hoveredNode && (
        <div
          className="tooltip"
          style={{
            display: 'block',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`
          }}
        >
          <div className="tooltip-inner">
            <div className="tt-code">{hoveredNode.code}</div>
            <div className="tt-type">
              <div className={`tt-type ${hoveredNode.stayAllow ? 'stay' : hoveredNode.type === 8 ? 'station' : 'path'}`}>
                {hoveredNode.stayAllow ? 'Stay-Allow' : hoveredNode.type === 8 ? 'Station' : 'Path Node'} · type {hoveredNode.type}
              </div>
            </div>
            <div className="tt-grid">
              <span className="tt-label">Node ID</span>
              <span className="tt-val">{hoveredNode.id}</span>
              <span className="tt-label">Position X</span>
              <span className="tt-val">{hoveredNode.position[0].toFixed(3)}</span>
              <span className="tt-label">Position Y</span>
              <span className="tt-val">{hoveredNode.position[1].toFixed(3)}</span>
              <span className="tt-label">Connections</span>
              <span className="tt-val">{hoveredNode.line?.length || 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
