// Viewport Culling & Spatial Indexing for massive graphs (1M+ nodes)

interface Point2D {
  x: number;
  y: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface QuadTreeNode<T> {
  bounds: BoundingBox;
  items: Array<{ point: Point2D; data: T }>;
  children: QuadTreeNode<T>[] | null;
  capacity: number;
  divided: boolean;
}

export class QuadTree<T> {
  private root: QuadTreeNode<T>;
  private readonly maxDepth: number;

  constructor(bounds: BoundingBox, capacity: number = 4, maxDepth: number = 8) {
    this.root = {
      bounds,
      items: [],
      children: null,
      capacity,
      divided: false
    };
    this.maxDepth = maxDepth;
  }

  insert(point: Point2D, data: T, depth: number = 0): boolean {
    if (!this.contains(this.root.bounds, point)) {
      return false;
    }

    if (this.root.items.length < this.root.capacity || depth >= this.maxDepth) {
      this.root.items.push({ point, data });
      return true;
    }

    if (!this.root.divided) {
      this.subdivide(this.root);
    }

    for (const child of this.root.children!) {
      if (this.containsPoint(child.bounds, point)) {
        const childTree = new QuadTree<T>(child.bounds, this.root.capacity, this.maxDepth);
        childTree.root = child;
        return childTree.insert(point, data, depth + 1);
      }
    }

    return false;
  }

  query(range: BoundingBox, found: Array<{ point: Point2D; data: T }> = []): Array<{ point: Point2D; data: T }> {
    if (!this.intersects(this.root.bounds, range)) {
      return found;
    }

    for (const item of this.root.items) {
      if (this.containsPoint(range, item.point)) {
        found.push(item);
      }
    }

    if (this.root.divided && this.root.children) {
      for (const child of this.root.children) {
        const childTree = new QuadTree<T>(child.bounds, this.root.capacity, this.maxDepth);
        childTree.root = child;
        childTree.query(range, found);
      }
    }

    return found;
  }

  private subdivide(node: QuadTreeNode<T>): void {
    const { minX, minY, maxX, maxY } = node.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    node.children = [
      // NW quadrant
      {
        bounds: { minX, minY: midY, maxX: midX, maxY },
        items: [],
        children: null,
        capacity: node.capacity,
        divided: false
      },
      // NE quadrant
      {
        bounds: { minX: midX, minY: midY, maxX, maxY },
        items: [],
        children: null,
        capacity: node.capacity,
        divided: false
      },
      // SW quadrant
      {
        bounds: { minX, minY, maxX: midX, maxY: midY },
        items: [],
        children: null,
        capacity: node.capacity,
        divided: false
      },
      // SE quadrant
      {
        bounds: { minX: midX, minY, maxX, maxY: midY },
        items: [],
        children: null,
        capacity: node.capacity,
        divided: false
      }
    ];

    node.divided = true;
  }

  private contains(bounds: BoundingBox, point: Point2D): boolean {
    return (
      point.x >= bounds.minX &&
      point.x < bounds.maxX &&
      point.y >= bounds.minY &&
      point.y < bounds.maxY
    );
  }

  private containsPoint(bounds: BoundingBox, point: Point2D): boolean {
    return this.contains(bounds, point);
  }

  private intersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.maxX < b.minX ||
      a.minX > b.maxX ||
      a.maxY < b.minY ||
      a.minY > b.maxY
    );
  }

  clear(): void {
    this.root.items = [];
    this.root.children = null;
    this.root.divided = false;
  }

  size(): number {
    return this.countItems(this.root);
  }

  private countItems(node: QuadTreeNode<T>): number {
    let count = node.items.length;
    if (node.divided && node.children) {
      for (const child of node.children) {
        count += this.countItems(child);
      }
    }
    return count;
  }
}

// LOD (Level of Detail) system
export enum LODLevel {
  ULTRA = 0,  // Full detail (zoom > 2.0)
  HIGH = 1,   // High detail (zoom 1.0-2.0)
  MEDIUM = 2, // Medium detail (zoom 0.5-1.0)
  LOW = 3     // Low detail (zoom < 0.5)
}

export interface LODConfig {
  level: LODLevel;
  maxNodes: number;
  maxEdges: number;
  nodeSimplification: boolean;
  edgeSimplification: boolean;
}

export const LOD_CONFIGS: Record<LODLevel, LODConfig> = {
  [LODLevel.ULTRA]: {
    level: LODLevel.ULTRA,
    maxNodes: 50000,
    maxEdges: 150000,
    nodeSimplification: false,
    edgeSimplification: false
  },
  [LODLevel.HIGH]: {
    level: LODLevel.HIGH,
    maxNodes: 25000,
    maxEdges: 75000,
    nodeSimplification: false,
    edgeSimplification: true
  },
  [LODLevel.MEDIUM]: {
    level: LODLevel.MEDIUM,
    maxNodes: 10000,
    maxEdges: 30000,
    nodeSimplification: true,
    edgeSimplification: true
  },
  [LODLevel.LOW]: {
    level: LODLevel.LOW,
    maxNodes: 5000,
    maxEdges: 15000,
    nodeSimplification: true,
    edgeSimplification: true
  }
};

export function getLODLevel(zoom: number): LODLevel {
  if (zoom > 2.0) return LODLevel.ULTRA;
  if (zoom > 1.0) return LODLevel.HIGH;
  if (zoom > 0.5) return LODLevel.MEDIUM;
  return LODLevel.LOW;
}

// Viewport culling utilities
export interface ViewportInfo {
  center: Point2D;
  width: number;
  height: number;
  zoom: number;
  bounds: BoundingBox;
}

export function calculateViewportBounds(
  center: Point2D,
  width: number,
  height: number,
  zoom: number
): BoundingBox {
  const halfWidth = (width / 2) / zoom;
  const halfHeight = (height / 2) / zoom;

  return {
    minX: center.x - halfWidth,
    maxX: center.x + halfWidth,
    minY: center.y - halfHeight,
    maxY: center.y + halfHeight
  };
}

export function expandBounds(bounds: BoundingBox, margin: number): BoundingBox {
  return {
    minX: bounds.minX - margin,
    maxX: bounds.maxX + margin,
    minY: bounds.minY - margin,
    maxY: bounds.maxY + margin
  };
}

export function isPointInBounds(point: Point2D, bounds: BoundingBox): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}
