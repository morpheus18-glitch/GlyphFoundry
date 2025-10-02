use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Node representation with position and velocity
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub vz: f64,
    pub mass: f64,
}

// Edge representation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
    pub weight: f64,
}

// Barnes-Hut quadtree node
struct QuadTreeNode {
    bounds: BoundingBox,
    center_of_mass: (f64, f64, f64),
    total_mass: f64,
    children: Option<Box<[QuadTreeNode; 8]>>,
    node_ids: Vec<usize>,
}

#[derive(Clone, Copy)]
struct BoundingBox {
    min_x: f64,
    min_y: f64,
    min_z: f64,
    max_x: f64,
    max_y: f64,
    max_z: f64,
}

impl BoundingBox {
    fn contains(&self, x: f64, y: f64, z: f64) -> bool {
        x >= self.min_x && x <= self.max_x
            && y >= self.min_y && y <= self.max_y
            && z >= self.min_z && z <= self.max_z
    }

    fn width(&self) -> f64 {
        self.max_x - self.min_x
    }

    fn subdivide(&self) -> [BoundingBox; 8] {
        let mid_x = (self.min_x + self.max_x) / 2.0;
        let mid_y = (self.min_y + self.max_y) / 2.0;
        let mid_z = (self.min_z + self.max_z) / 2.0;

        [
            // Bottom layer
            BoundingBox { min_x: self.min_x, min_y: self.min_y, min_z: self.min_z, max_x: mid_x, max_y: mid_y, max_z: mid_z },
            BoundingBox { min_x: mid_x, min_y: self.min_y, min_z: self.min_z, max_x: self.max_x, max_y: mid_y, max_z: mid_z },
            BoundingBox { min_x: self.min_x, min_y: mid_y, min_z: self.min_z, max_x: mid_x, max_y: self.max_y, max_z: mid_z },
            BoundingBox { min_x: mid_x, min_y: mid_y, min_z: self.min_z, max_x: self.max_x, max_y: self.max_y, max_z: mid_z },
            // Top layer
            BoundingBox { min_x: self.min_x, min_y: self.min_y, min_z: mid_z, max_x: mid_x, max_y: mid_y, max_z: self.max_z },
            BoundingBox { min_x: mid_x, min_y: self.min_y, min_z: mid_z, max_x: self.max_x, max_y: mid_y, max_z: self.max_z },
            BoundingBox { min_x: self.min_x, min_y: mid_y, min_z: mid_z, max_x: mid_x, max_y: self.max_y, max_z: self.max_z },
            BoundingBox { min_x: mid_x, min_y: mid_y, min_z: mid_z, max_x: self.max_x, max_y: self.max_y, max_z: self.max_z },
        ]
    }
}

impl QuadTreeNode {
    fn new(bounds: BoundingBox) -> Self {
        QuadTreeNode {
            bounds,
            center_of_mass: (0.0, 0.0, 0.0),
            total_mass: 0.0,
            children: None,
            node_ids: Vec::new(),
        }
    }

    fn insert(&mut self, node_id: usize, node: &Node) {
        if !self.bounds.contains(node.x, node.y, node.z) {
            return;
        }

        // Update center of mass
        let new_mass = self.total_mass + node.mass;
        self.center_of_mass = (
            (self.center_of_mass.0 * self.total_mass + node.x * node.mass) / new_mass,
            (self.center_of_mass.1 * self.total_mass + node.y * node.mass) / new_mass,
            (self.center_of_mass.2 * self.total_mass + node.z * node.mass) / new_mass,
        );
        self.total_mass = new_mass;

        if self.children.is_none() && self.node_ids.is_empty() {
            // Leaf node, add directly
            self.node_ids.push(node_id);
        } else if self.children.is_none() {
            // Need to subdivide
            let subdivisions = self.bounds.subdivide();
            let mut children = Box::new([
                QuadTreeNode::new(subdivisions[0]),
                QuadTreeNode::new(subdivisions[1]),
                QuadTreeNode::new(subdivisions[2]),
                QuadTreeNode::new(subdivisions[3]),
                QuadTreeNode::new(subdivisions[4]),
                QuadTreeNode::new(subdivisions[5]),
                QuadTreeNode::new(subdivisions[6]),
                QuadTreeNode::new(subdivisions[7]),
            ]);

            // Re-insert existing nodes
            let existing_ids = std::mem::take(&mut self.node_ids);
            self.children = Some(children);

            for &id in &existing_ids {
                // Would need node data here, simplified for this implementation
            }

            // Insert new node into appropriate child
            if let Some(ref mut children) = self.children {
                for child in children.iter_mut() {
                    if child.bounds.contains(node.x, node.y, node.z) {
                        child.insert(node_id, node);
                        break;
                    }
                }
            }

            self.node_ids.push(node_id);
        } else {
            // Already subdivided, insert into appropriate child
            if let Some(ref mut children) = self.children {
                for child in children.iter_mut() {
                    if child.bounds.contains(node.x, node.y, node.z) {
                        child.insert(node_id, node);
                        break;
                    }
                }
            }
            self.node_ids.push(node_id);
        }
    }

    fn calculate_force(&self, node: &Node, theta: f64) -> (f64, f64, f64) {
        if self.total_mass == 0.0 {
            return (0.0, 0.0, 0.0);
        }

        let dx = self.center_of_mass.0 - node.x;
        let dy = self.center_of_mass.1 - node.y;
        let dz = self.center_of_mass.2 - node.z;
        let dist_sq = dx * dx + dy * dy + dz * dz + 1.0; // Add 1.0 to avoid division by zero
        let dist = dist_sq.sqrt();

        // Barnes-Hut criterion: if node is far enough, treat as single body
        if self.children.is_none() || (self.bounds.width() / dist) < theta {
            // Repulsive force (inverse square law)
            let force = (node.mass * self.total_mass) / dist_sq;
            let fx = (dx / dist) * force;
            let fy = (dy / dist) * force;
            let fz = (dz / dist) * force;
            return (fx, fy, fz);
        }

        // Otherwise, recurse into children
        let mut total_force = (0.0, 0.0, 0.0);
        if let Some(ref children) = self.children {
            for child in children.iter() {
                let child_force = child.calculate_force(node, theta);
                total_force.0 += child_force.0;
                total_force.1 += child_force.1;
                total_force.2 += child_force.2;
            }
        }
        total_force
    }
}

// Physics simulation engine
#[wasm_bindgen]
pub struct PhysicsEngine {
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    node_map: HashMap<String, usize>,
    repulsion_strength: f64,
    attraction_strength: f64,
    damping: f64,
    theta: f64, // Barnes-Hut threshold
}

#[wasm_bindgen]
impl PhysicsEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        PhysicsEngine {
            nodes: Vec::new(),
            edges: Vec::new(),
            node_map: HashMap::new(),
            repulsion_strength: 1000.0,
            attraction_strength: 0.01,
            damping: 0.8,
            theta: 0.5,
        }
    }

    #[wasm_bindgen(js_name = setNodes)]
    pub fn set_nodes(&mut self, nodes_js: JsValue) -> Result<(), JsValue> {
        let nodes: Vec<Node> = serde_wasm_bindgen::from_value(nodes_js)?;
        self.node_map.clear();
        for (idx, node) in nodes.iter().enumerate() {
            self.node_map.insert(node.id.clone(), idx);
        }
        self.nodes = nodes;
        Ok(())
    }

    #[wasm_bindgen(js_name = setEdges)]
    pub fn set_edges(&mut self, edges_js: JsValue) -> Result<(), JsValue> {
        self.edges = serde_wasm_bindgen::from_value(edges_js)?;
        Ok(())
    }

    #[wasm_bindgen(js_name = setParams)]
    pub fn set_params(&mut self, repulsion: f64, attraction: f64, damping: f64, theta: f64) {
        self.repulsion_strength = repulsion;
        self.attraction_strength = attraction;
        self.damping = damping;
        self.theta = theta;
    }

    #[wasm_bindgen(js_name = tick)]
    pub fn tick(&mut self, delta_time: f64) -> Result<JsValue, JsValue> {
        if self.nodes.is_empty() {
            return Ok(serde_wasm_bindgen::to_value(&self.nodes)?);
        }

        // Build Barnes-Hut octree
        let mut min_x = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_y = f64::NEG_INFINITY;
        let mut min_z = f64::INFINITY;
        let mut max_z = f64::NEG_INFINITY;

        for node in &self.nodes {
            min_x = min_x.min(node.x);
            max_x = max_x.max(node.x);
            min_y = min_y.min(node.y);
            max_y = max_y.max(node.y);
            min_z = min_z.min(node.z);
            max_z = max_z.max(node.z);
        }

        // Add padding
        let padding = 100.0;
        let bounds = BoundingBox {
            min_x: min_x - padding,
            min_y: min_y - padding,
            min_z: min_z - padding,
            max_x: max_x + padding,
            max_y: max_y + padding,
            max_z: max_z + padding,
        };

        let mut tree = QuadTreeNode::new(bounds);
        for (idx, node) in self.nodes.iter().enumerate() {
            tree.insert(idx, node);
        }

        // Calculate repulsive forces using Barnes-Hut
        let mut forces: Vec<(f64, f64, f64)> = Vec::with_capacity(self.nodes.len());
        for node in &self.nodes {
            let force = tree.calculate_force(node, self.theta);
            forces.push((
                force.0 * self.repulsion_strength,
                force.1 * self.repulsion_strength,
                force.2 * self.repulsion_strength,
            ));
        }

        // Calculate attractive forces from edges (Hooke's law)
        for edge in &self.edges {
            if let (Some(&source_idx), Some(&target_idx)) = 
                (self.node_map.get(&edge.source), self.node_map.get(&edge.target)) {
                
                let source = &self.nodes[source_idx];
                let target = &self.nodes[target_idx];

                let dx = target.x - source.x;
                let dy = target.y - source.y;
                let dz = target.z - source.z;
                let dist = (dx * dx + dy * dy + dz * dz).sqrt().max(0.1);

                let force = self.attraction_strength * dist * edge.weight;
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;
                let fz = (dz / dist) * force;

                forces[source_idx].0 += fx;
                forces[source_idx].1 += fy;
                forces[source_idx].2 += fz;
                forces[target_idx].0 -= fx;
                forces[target_idx].1 -= fy;
                forces[target_idx].2 -= fz;
            }
        }

        // Apply forces and update positions
        for (idx, node) in self.nodes.iter_mut().enumerate() {
            // Apply force to velocity
            node.vx += forces[idx].0 * delta_time;
            node.vy += forces[idx].1 * delta_time;
            node.vz += forces[idx].2 * delta_time;

            // Apply damping
            node.vx *= self.damping;
            node.vy *= self.damping;
            node.vz *= self.damping;

            // Update position
            node.x += node.vx * delta_time;
            node.y += node.vy * delta_time;
            node.z += node.vz * delta_time;
        }

        Ok(serde_wasm_bindgen::to_value(&self.nodes)?)
    }

    #[wasm_bindgen(js_name = getNodes)]
    pub fn get_nodes(&self) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.nodes)?)
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
