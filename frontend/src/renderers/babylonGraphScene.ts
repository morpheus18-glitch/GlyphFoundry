import {
  ActionManager,
  Animation,
  ArcRotateCamera,
  Color3,
  Curve3,
  ExecuteCodeAction,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ScenePerformancePriority,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import type { Nullable } from '@babylonjs/core/types';
import type { Observer } from '@babylonjs/core/Misc/observable';
import { GradientMaterial } from '@babylonjs/materials/gradient/gradientMaterial';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  size?: number;
  color?: string;
  label?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
}

interface NodeVisual {
  inner: Mesh;
  outer: Mesh;
  halo: Mesh;
  color: Color3;
  baseScale: number;
  phase: number;
}

interface EdgeVisual {
  mesh: Mesh;
  material: PBRMaterial;
  baseColor: Color3;
  pulseOffset: number;
  baseAlpha: number;
}

interface GraphSceneAssets {
  nodeVisuals: NodeVisual[];
  edgeVisuals: EdgeVisual[];
  animationObserver?: Nullable<Observer<Scene>>;
}

interface GraphSceneMetadata {
  assets?: GraphSceneAssets;
  backgroundMeshes?: Mesh[];
}

const GRAPH_METADATA_KEY = '__glyphFoundryGraph';

export function applyGraphScene(
  scene: Scene,
  nodes: GraphNode[],
  edges: GraphEdge[],
  onNodeClick?: (nodeId: string) => void
) {
  const metadata = ensureMetadata(scene);
  disposeGraphAssets(scene, metadata);
  ensureBackground(scene, metadata);

  if (!nodes.length) {
    metadata.assets = undefined;
    return;
  }

  const nodeColors = new Map<string, Color3>();
  const nodePositions = new Map<string, Vector3>();

  nodes.forEach((node) => {
    const color = colorFromHex(node.color || '#00ffff');
    nodeColors.set(node.id, color);
    nodePositions.set(node.id, new Vector3(node.x, node.y, node.z));
  });

  const nodeVisuals: NodeVisual[] = [];

  nodes.forEach((node, index) => {
    const position = nodePositions.get(node.id)!;
    const baseScale = Math.max((node.size || 10) * 16, 18);
    const color = nodeColors.get(node.id)!;

    const innerSphere = MeshBuilder.CreateIcoSphere(
      `node-inner-${node.id}`,
      {
        radius: baseScale * 0.9,
        subdivisions: 4,
        flat: false
      },
      scene
    );
    innerSphere.position = position.clone();
    innerSphere.isPickable = false;

    const innerMaterial = new PBRMaterial(`mat-inner-${node.id}`, scene);
    innerMaterial.albedoColor = color.scale(0.4);
    innerMaterial.emissiveColor = color.scale(3.6);
    innerMaterial.emissiveIntensity = 2.4;
    innerMaterial.metallic = 0.05;
    innerMaterial.roughness = 0.65;
    innerMaterial.alpha = 0.85;
    innerSphere.material = innerMaterial;

    const outerSphere = MeshBuilder.CreateIcoSphere(
      `node-${node.id}`,
      {
        radius: baseScale,
        subdivisions: 5,
        flat: true
      },
      scene
    );
    outerSphere.position = position.clone();
    outerSphere.renderingGroupId = 2;

    const outerMaterial = new PBRMaterial(`mat-outer-${node.id}`, scene);
    outerMaterial.albedoColor = color.scale(0.25);
    outerMaterial.emissiveColor = color.scale(4.5);
    outerMaterial.emissiveIntensity = 3.1;
    outerMaterial.metallic = 0.95;
    outerMaterial.roughness = 0.08;
    outerMaterial.wireframe = true;
    outerSphere.material = outerMaterial;

    const halo = MeshBuilder.CreateDisc(
      `node-halo-${node.id}`,
      {
        radius: baseScale * 1.8,
        tessellation: 64,
        sideOrientation: Mesh.DOUBLESIDE
      },
      scene
    );
    halo.position = position.clone();
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
    halo.renderingGroupId = 1;
    halo.isPickable = false;

    const haloMaterial = new StandardMaterial(`mat-halo-${node.id}`, scene);
    haloMaterial.emissiveColor = color.scale(2.2);
    haloMaterial.alpha = 0.35;
    haloMaterial.disableLighting = true;
    haloMaterial.backFaceCulling = false;
    halo.material = haloMaterial;

    if (onNodeClick) {
      outerSphere.actionManager = new ActionManager(scene);
      outerSphere.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
          const camera = scene.activeCamera as ArcRotateCamera | null;
          if (camera) {
            camera.setTarget(outerSphere.position);
            const distance = Math.max(baseScale * 6, 260);
            Animation.CreateAndStartAnimation(
              `cameraZoom-${node.id}`,
              camera,
              'radius',
              60,
              40,
              camera.radius,
              distance,
              0
            );
          }
          onNodeClick(node.id);
        })
      );
    }

    nodeVisuals.push({
      inner: innerSphere,
      outer: outerSphere,
      halo,
      color,
      baseScale,
      phase: (index % 12) * 0.45
    });
  });

  const edgeVisuals = buildEdges(scene, edges, nodePositions, nodeColors);

  const animationObserver = scene.onBeforeRenderObservable.add(() => {
    const time = performance.now() * 0.001;

    nodeVisuals.forEach((visual) => {
      if (visual.inner.isDisposed() || visual.outer.isDisposed() || visual.halo.isDisposed()) {
        return;
      }
      const pulse = 1 + Math.sin(time * 2.1 + visual.phase) * 0.18;
      visual.inner.scaling.setAll(pulse);
      visual.outer.scaling.setAll(pulse * 1.03);
      visual.inner.rotation.y += 0.004;
      visual.outer.rotation.y += 0.006;

      const haloPulse = 0.6 + Math.sin(time * 3.2 + visual.phase) * 0.4;
      const haloMaterial = visual.halo.material as StandardMaterial | null;
      if (haloMaterial) {
        haloMaterial.alpha = 0.25 + haloPulse * 0.35;
        haloMaterial.emissiveColor = visual.color.scale(2.4 + haloPulse * 1.6);
      }
    });

    edgeVisuals.forEach((visual) => {
      if (visual.mesh.isDisposed()) {
        return;
      }
      const pulse = 0.55 + Math.sin(time * 4.5 + visual.pulseOffset) * 0.45;
      visual.material.emissiveColor = visual.baseColor.scale(2.8 + pulse * 2.7);
      visual.material.alpha = visual.baseAlpha * (0.7 + pulse * 0.3);
    });
  });

  metadata.assets = {
    nodeVisuals,
    edgeVisuals,
    animationObserver
  };
}

export function disposeGraphScene(scene: Scene, { disposeBackground = false } = {}) {
  const metadata = ensureMetadata(scene);
  disposeGraphAssets(scene, metadata);

  if (disposeBackground && metadata.backgroundMeshes) {
    metadata.backgroundMeshes.forEach((mesh) => mesh.dispose());
    metadata.backgroundMeshes = undefined;
  }
}

function buildEdges(
  scene: Scene,
  edges: GraphEdge[],
  nodePositions: Map<string, Vector3>,
  nodeColors: Map<string, Color3>
): EdgeVisual[] {
  if (!edges.length) {
    return [];
  }

  const visuals: EdgeVisual[] = [];

  edges.forEach((edge, index) => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);

    if (!source || !target) {
      return;
    }

    const distance = Vector3.Distance(source, target);
    if (distance === 0) {
      return;
    }

    const intensity = Math.min(1, (edge.weight ?? 1) / 4);
    const baseRadius = Math.max(0.8, Math.min(6, (edge.weight ?? 1) * 0.4));

    const midpoint = Vector3.Center(source, target);
    const arcHeight = Math.min(600, distance * (0.12 + intensity * 0.2));
    const offset = computeOffset(edge, distance);
    const controlPoint = midpoint.add(new Vector3(offset.x, arcHeight, offset.z));

    const curve = Curve3.CreateCatmullRomSpline([source, controlPoint, target], 20);
    const path = curve.getPoints();

    const tube = MeshBuilder.CreateTube(
      `edge-${edge.source}-${edge.target}-${index}`,
      {
        path,
        radius: baseRadius,
        tessellation: 48,
        updatable: false
      },
      scene
    );
    tube.isPickable = false;
    tube.renderingGroupId = 1;

    const sourceColor = nodeColors.get(edge.source) || new Color3(0, 1, 1);
    const targetColor = nodeColors.get(edge.target) || new Color3(1, 0, 1);
    const baseColor = Color3.Lerp(sourceColor, targetColor, 0.5);

    const material = new PBRMaterial(`edge-material-${index}`, scene);
    material.albedoColor = baseColor.scale(0.15);
    material.emissiveColor = baseColor.scale(3.2 + intensity * 2.0);
    material.emissiveIntensity = 1.0;
    material.metallic = 0.6;
    material.roughness = 0.25;
    material.alpha = 0.55 + intensity * 0.35;
    material.backFaceCulling = false;
    tube.material = material;

    visuals.push({
      mesh: tube,
      material,
      baseColor,
      pulseOffset: (index % 17) * 0.35,
      baseAlpha: material.alpha
    });
  });

  return visuals;
}

function computeOffset(edge: GraphEdge, magnitude: number) {
  const seedX = pseudoRandom(edge.source + edge.target);
  const seedZ = pseudoRandom(edge.target + edge.source + '-z');
  const spread = magnitude * 0.18;
  return {
    x: (seedX - 0.5) * spread,
    z: (seedZ - 0.5) * spread
  };
}

function pseudoRandom(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = Math.imul(31, hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

function ensureBackground(scene: Scene, metadata: GraphSceneMetadata) {
  if (metadata.backgroundMeshes) {
    return;
  }

  scene.performancePriority = ScenePerformancePriority.Aggressive;
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0022;
  scene.fogColor = new Color3(0.01, 0.015, 0.03);

  const skySphere = MeshBuilder.CreateSphere(
    'graph-sky',
    {
      diameter: 20000,
      segments: 64,
      sideOrientation: Mesh.BACKSIDE
    },
    scene
  );
  skySphere.isPickable = false;
  skySphere.renderingGroupId = 0;

  const gradient = new GradientMaterial('graph-sky-mat', scene);
  gradient.topColor = new Color3(0.02, 0.05, 0.1);
  gradient.bottomColor = new Color3(0.0, 0.0, 0.0);
  gradient.offset = 0.7;
  gradient.smoothness = 1.0;
  gradient.disableLighting = true;
  gradient.backFaceCulling = false;
  skySphere.material = gradient;

  const horizon = MeshBuilder.CreateDisc(
    'graph-horizon',
    {
      radius: 6500,
      tessellation: 64
    },
    scene
  );
  horizon.position.y = -260;
  horizon.isPickable = false;
  horizon.renderingGroupId = 0;

  const horizonMaterial = new StandardMaterial('graph-horizon-mat', scene);
  horizonMaterial.emissiveColor = new Color3(0.04, 0.05, 0.08);
  horizonMaterial.alpha = 0.2;
  horizonMaterial.backFaceCulling = false;
  horizonMaterial.disableLighting = true;
  horizon.material = horizonMaterial;

  metadata.backgroundMeshes = [skySphere, horizon];
}

function ensureMetadata(scene: Scene): GraphSceneMetadata {
  const metadata = (scene.metadata ??= {} as Record<string, unknown>);
  const existing = metadata[GRAPH_METADATA_KEY] as GraphSceneMetadata | undefined;
  if (existing) {
    return existing;
  }
  const created: GraphSceneMetadata = {};
  metadata[GRAPH_METADATA_KEY] = created;
  return created;
}

function disposeGraphAssets(scene: Scene, metadata: GraphSceneMetadata) {
  if (!metadata.assets) {
    return;
  }

  metadata.assets.nodeVisuals.forEach((visual) => {
    visual.inner.dispose();
    visual.outer.dispose();
    visual.halo.dispose();
  });

  metadata.assets.edgeVisuals.forEach((visual) => {
    visual.mesh.dispose();
    visual.material.dispose();
  });

  if (metadata.assets.animationObserver) {
    scene.onBeforeRenderObservable.remove(metadata.assets.animationObserver);
  }

  metadata.assets = undefined;
}

function colorFromHex(hex: string): Color3 {
  const normalized = hex.trim();
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!match) {
    return new Color3(0, 1, 1);
  }
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;
  return new Color3(r, g, b);
}
