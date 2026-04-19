use anyhow::{Context, Result};
use chrono::Utc;
use directories::ProjectDirs;
use eframe::egui;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    sync::mpsc::{self, Receiver},
    thread,
};
use walkdir::WalkDir;

const MANIFEST_FILE: &str = "_skilltree.json";
const TREE_NOTE_FILE: &str = "tree.md";
const DEFAULT_ROOT_FOLDER: &str = "SkillTree";
const DEFAULT_OBSIDIAN_VAULT: &str = "/home/aytzey/Documents/Obsidian Vault";
const GITHUB_OWNER: &str = "aytzey";
const GITHUB_REPO: &str = "SkillTree";
const NODE_COLUMN_WIDTH: f32 = 200.0;
const NODE_ORB_CENTER_Y: f32 = 38.0;
const NODE_INTERACT_HEIGHT: f32 = 128.0;

const BG0: egui::Color32 = egui::Color32::from_rgb(7, 9, 15);
const BG1: egui::Color32 = egui::Color32::from_rgb(11, 16, 24);
const BG2: egui::Color32 = egui::Color32::from_rgb(18, 24, 36);
const BG3: egui::Color32 = egui::Color32::from_rgb(26, 34, 50);
const BG4: egui::Color32 = egui::Color32::from_rgb(35, 45, 64);
const FG1: egui::Color32 = egui::Color32::from_rgb(236, 227, 207);
const FG2: egui::Color32 = egui::Color32::from_rgb(185, 178, 154);
const FG3: egui::Color32 = egui::Color32::from_rgb(122, 117, 102);
const BORDER1: egui::Color32 = egui::Color32::from_rgb(30, 39, 56);
const BORDER2: egui::Color32 = egui::Color32::from_rgb(44, 54, 72);
const BORDER3: egui::Color32 = egui::Color32::from_rgb(69, 80, 106);
const ACCENT: egui::Color32 = egui::Color32::from_rgb(217, 178, 76);
const ACCENT_2: egui::Color32 = egui::Color32::from_rgb(244, 217, 133);
const STATUS_LOCKED: egui::Color32 = egui::Color32::from_rgb(74, 71, 56);
const STATUS_READY: egui::Color32 = egui::Color32::from_rgb(196, 162, 87);
const STATUS_IN_PROGRESS: egui::Color32 = egui::Color32::from_rgb(111, 181, 194);
const STATUS_DONE: egui::Color32 = egui::Color32::from_rgb(232, 194, 90);

fn main() -> eframe::Result {
    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 820.0])
            .with_min_inner_size([980.0, 640.0])
            .with_title("SkillTree Local"),
        ..Default::default()
    };

    eframe::run_native(
        "SkillTree Local",
        native_options,
        Box::new(|cc| Ok(Box::new(SkillTreeApp::new(cc)))),
    )
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum NodeStatus {
    Locked,
    #[default]
    Available,
    InProgress,
    Completed,
}

impl NodeStatus {
    fn label(&self) -> &'static str {
        match self {
            Self::Locked => "Sealed",
            Self::Available => "Unlocked",
            Self::InProgress => "In Progress",
            Self::Completed => "Forged",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum EdgeType {
    Prerequisite,
    Recommended,
    Optional,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum ShareMode {
    #[default]
    Private,
    PublicReadonly,
    PublicEdit,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct SubTask {
    title: String,
    done: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct Resource {
    title: String,
    url: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillNode {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    tree_id: String,
    id: String,
    #[serde(default)]
    parent_id: Option<String>,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default = "default_difficulty")]
    difficulty: u8,
    #[serde(default)]
    estimated_hours: Option<f32>,
    #[serde(default)]
    progress: u8,
    #[serde(default)]
    status: NodeStatus,
    #[serde(default)]
    position_x: f32,
    #[serde(default)]
    position_y: f32,
    #[serde(default)]
    style: Option<serde_json::Value>,
    #[serde(default)]
    sub_tasks: Vec<SubTask>,
    #[serde(default)]
    resources: Vec<Resource>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    sub_tree_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillEdge {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    tree_id: String,
    id: String,
    source_node_id: String,
    target_node_id: String,
    #[serde(default = "default_edge_type")]
    r#type: EdgeType,
    #[serde(default)]
    style: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillTree {
    id: String,
    user_id: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    slug: String,
    #[serde(default)]
    is_public: bool,
    #[serde(default)]
    share_mode: ShareMode,
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default)]
    canvas_state: Option<serde_json::Value>,
    #[serde(default)]
    nodes: Vec<SkillNode>,
    #[serde(default)]
    edges: Vec<SkillEdge>,
    #[serde(skip)]
    folder: PathBuf,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreeMeta {
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default)]
    canvas_state: Option<serde_json::Value>,
    slug: String,
    #[serde(default)]
    is_public: bool,
    #[serde(default)]
    share_mode: ShareMode,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ObsidianMeta {
    #[serde(rename = "appTreeId")]
    app_tree_id: String,
    #[serde(rename = "appUserId")]
    app_user_id: String,
    #[serde(rename = "rootFolder")]
    root_folder: String,
    #[serde(rename = "treeNotePath")]
    tree_note_path: String,
    #[serde(rename = "nodePaths")]
    node_paths: HashMap<String, String>,
    #[serde(rename = "generatedAt")]
    generated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Manifest {
    version: u8,
    format: String,
    tree: TreeMeta,
    #[serde(default)]
    nodes: Vec<SkillNode>,
    #[serde(default)]
    edges: Vec<SkillEdge>,
    #[serde(default)]
    obsidian: Option<ObsidianMeta>,
}

#[derive(Clone, Debug)]
struct ParsedNodeNote {
    node: SkillNode,
    dependencies: HashMap<EdgeTypeKey, Vec<String>>,
    has_dependency_metadata: bool,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
enum EdgeTypeKey {
    Prerequisite,
    Recommended,
    Optional,
}

impl EdgeTypeKey {
    fn to_edge_type(&self) -> EdgeType {
        match self {
            Self::Prerequisite => EdgeType::Prerequisite,
            Self::Recommended => EdgeType::Recommended,
            Self::Optional => EdgeType::Optional,
        }
    }
}

struct SkillTreeApp {
    storage_root: PathBuf,
    trees: Vec<SkillTree>,
    selected_tree: Option<usize>,
    selected_node_id: Option<String>,
    status_line: String,
    new_tree_title: String,
    new_node_title: String,
    new_subtask_title: String,
    new_resource_title: String,
    new_resource_url: String,
    tree_filter: String,
    canvas_offset: egui::Vec2,
    canvas_zoom: f32,
    update_rx: Option<Receiver<String>>,
}

impl SkillTreeApp {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        apply_design_system(&cc.egui_ctx);
        let storage_root = default_storage_root();
        let mut app = Self {
            storage_root,
            trees: Vec::new(),
            selected_tree: None,
            selected_node_id: None,
            status_line: String::from("Ready"),
            new_tree_title: String::new(),
            new_node_title: String::new(),
            new_subtask_title: String::new(),
            new_resource_title: String::new(),
            new_resource_url: String::new(),
            tree_filter: String::new(),
            canvas_offset: egui::vec2(140.0, 80.0),
            canvas_zoom: 0.9,
            update_rx: start_update_check(),
        };
        app.reload();
        app
    }

    fn poll_update_status(&mut self) {
        let Some(rx) = &self.update_rx else {
            return;
        };

        while let Ok(message) = rx.try_recv() {
            self.status_line = message;
        }
    }

    fn reload(&mut self) {
        match load_trees(&self.storage_root) {
            Ok(trees) => {
                self.trees = trees;
                if self.trees.is_empty() {
                    self.selected_tree = None;
                    self.selected_node_id = None;
                } else {
                    let next_index = self.selected_tree.unwrap_or(0).min(self.trees.len() - 1);
                    self.selected_tree = Some(next_index);
                    if self.selected_node_id.is_none() {
                        self.selected_node_id = self.trees[next_index]
                            .nodes
                            .first()
                            .map(|node| node.id.clone());
                    }
                }
                self.status_line = format!("Loaded {} tree(s)", self.trees.len());
            }
            Err(error) => self.status_line = format!("Load failed: {error:#}"),
        }
    }

    fn selected_tree_mut(&mut self) -> Option<&mut SkillTree> {
        self.selected_tree
            .and_then(|index| self.trees.get_mut(index))
    }

    fn selected_tree_ref(&self) -> Option<&SkillTree> {
        self.selected_tree.and_then(|index| self.trees.get(index))
    }

    fn save_selected_tree(&mut self) {
        let Some(index) = self.selected_tree else {
            return;
        };
        match write_tree(&self.storage_root, &mut self.trees[index]) {
            Ok(()) => self.status_line = format!("Saved {}", self.trees[index].title),
            Err(error) => self.status_line = format!("Save failed: {error:#}"),
        }
    }

    fn create_tree(&mut self) {
        let title = self.new_tree_title.trim();
        if title.is_empty() {
            return;
        }

        let id = format!("local-{}", Utc::now().timestamp_millis());
        let slug = format!(
            "{}-{}",
            slugify(title, "skill-tree"),
            &id[id.len().saturating_sub(5)..]
        );
        let mut tree = SkillTree {
            id: id.clone(),
            user_id: "local-desktop".to_string(),
            title: title.to_string(),
            description: None,
            slug,
            is_public: false,
            share_mode: ShareMode::Private,
            theme: default_theme(),
            canvas_state: None,
            nodes: Vec::new(),
            edges: Vec::new(),
            folder: PathBuf::new(),
        };

        match write_tree(&self.storage_root, &mut tree) {
            Ok(()) => {
                self.trees.push(tree);
                self.selected_tree = Some(self.trees.len() - 1);
                self.selected_node_id = None;
                self.new_tree_title.clear();
                self.status_line = "Created tree".to_string();
            }
            Err(error) => self.status_line = format!("Create failed: {error:#}"),
        }
    }

    fn create_node(&mut self, parent_id: Option<String>) {
        let title = self.new_node_title.trim().to_string();
        if title.is_empty() {
            return;
        }

        let Some(tree) = self.selected_tree_mut() else {
            return;
        };
        let sibling_count = tree
            .nodes
            .iter()
            .filter(|node| node.parent_id == parent_id)
            .count();
        let parent = parent_id
            .as_ref()
            .and_then(|id| tree.nodes.iter().find(|node| &node.id == id));
        let node_id = format!(
            "node-{}-{}",
            Utc::now().timestamp_millis(),
            sibling_count + 1
        );
        let node = SkillNode {
            tree_id: tree.id.clone(),
            id: node_id.clone(),
            parent_id: parent_id.clone(),
            title,
            description: None,
            difficulty: 1,
            estimated_hours: None,
            progress: 0,
            status: if parent_id.is_some() {
                NodeStatus::Locked
            } else {
                NodeStatus::Available
            },
            position_x: parent
                .map(|node| node.position_x + 220.0)
                .unwrap_or((sibling_count * 220) as f32),
            position_y: parent.map(|node| node.position_y + 140.0).unwrap_or(0.0),
            style: None,
            sub_tasks: Vec::new(),
            resources: Vec::new(),
            notes: None,
            sub_tree_id: None,
        };

        if let Some(source_node_id) = parent_id {
            tree.edges.push(SkillEdge {
                tree_id: tree.id.clone(),
                id: edge_id(&source_node_id, &node_id, &EdgeType::Prerequisite),
                source_node_id,
                target_node_id: node_id.clone(),
                r#type: EdgeType::Prerequisite,
                style: None,
            });
        }

        tree.nodes.push(node);
        self.selected_node_id = Some(node_id);
        self.new_node_title.clear();
        self.save_selected_tree();
    }

    fn open_selected_node_note(&mut self) {
        let Some(tree) = self.selected_tree_ref() else {
            return;
        };
        let Some(node_id) = self.selected_node_id.as_deref() else {
            return;
        };
        let paths = build_node_paths(&self.storage_root, tree);
        let Some(path) = paths.get(node_id) else {
            return;
        };

        match opener::open(path) {
            Ok(()) => self.status_line = "Opened node note".to_string(),
            Err(error) => self.status_line = format!("Open failed: {error}"),
        }
    }

    fn choose_storage_root(&mut self) {
        if let Some(path) = rfd::FileDialog::new()
            .set_title("Choose SkillTree storage folder")
            .pick_folder()
        {
            self.storage_root = path;
            self.reload();
        }
    }

    fn use_obsidian_vault(&mut self) {
        let vault_path =
            env::var("OBSIDIAN_VAULT_PATH").unwrap_or_else(|_| DEFAULT_OBSIDIAN_VAULT.to_string());
        let root =
            env::var("SKILLTREE_OBSIDIAN_ROOT").unwrap_or_else(|_| DEFAULT_ROOT_FOLDER.to_string());
        self.storage_root = Path::new(&vault_path).join(root);
        self.reload();
    }
}

impl eframe::App for SkillTreeApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.poll_update_status();

        if ctx.input_mut(|input| input.consume_key(egui::Modifiers::COMMAND, egui::Key::S)) {
            self.save_selected_tree();
        }
        if ctx.input_mut(|input| input.consume_key(egui::Modifiers::COMMAND, egui::Key::R)) {
            self.reload();
        }

        egui::TopBottomPanel::top("top_bar")
            .exact_height(42.0)
            .show(ctx, |ui| self.render_top_bar(ui));

        egui::TopBottomPanel::bottom("status_bar")
            .exact_height(26.0)
            .show(ctx, |ui| self.render_status_bar(ui));

        egui::SidePanel::left("tree_sidebar")
            .resizable(false)
            .exact_width(260.0)
            .show(ctx, |ui| self.render_tree_rail(ui));

        egui::SidePanel::right("inspector")
            .resizable(false)
            .exact_width(380.0)
            .show(ctx, |ui| self.render_inspector(ui));

        egui::CentralPanel::default().show(ctx, |ui| {
            self.render_canvas(ui);
        });
    }
}

impl SkillTreeApp {
    fn render_top_bar(&mut self, ui: &mut egui::Ui) {
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, 0.0, BG0);
        ui.painter().line_segment(
            [rect.left_bottom(), rect.right_bottom()],
            egui::Stroke::new(1.0, BORDER1),
        );

        ui.add_space(4.0);
        ui.horizontal_centered(|ui| {
            ui.add_space(4.0);
            ui.label(
                egui::RichText::new("SkillTree")
                    .strong()
                    .color(FG1)
                    .size(14.0),
            );
            ui.label(
                egui::RichText::new("LOCAL")
                    .monospace()
                    .color(ACCENT_2)
                    .size(10.0),
            );
            ui.separator();
            ui.label(
                egui::RichText::new("Storage")
                    .monospace()
                    .color(FG3)
                    .size(11.0),
            );
            ui.label(
                egui::RichText::new(short_path(&self.storage_root, 62))
                    .monospace()
                    .color(FG2)
                    .size(11.0),
            );

            if ui.add(toolbar_button("Choose folder")).clicked() {
                self.choose_storage_root();
            }
            if ui.add(toolbar_button("Use Obsidian Vault")).clicked() {
                self.use_obsidian_vault();
            }
            if ui.add(toolbar_button("Reload")).clicked() {
                self.reload();
            }
            if ui.add(primary_toolbar_button("Save")).clicked() {
                self.save_selected_tree();
            }

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let selected = self
                    .selected_tree_ref()
                    .map(|tree| tree.title.as_str())
                    .unwrap_or("No tree");
                ui.label(
                    egui::RichText::new(selected)
                        .monospace()
                        .color(FG3)
                        .size(11.0),
                );
            });
        });
    }

    fn render_status_bar(&mut self, ui: &mut egui::Ui) {
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, 0.0, BG0);
        ui.painter().line_segment(
            [rect.left_top(), rect.right_top()],
            egui::Stroke::new(1.0, BORDER1),
        );

        let total_nodes = self
            .trees
            .iter()
            .map(|tree| tree.nodes.len())
            .sum::<usize>();
        let total_done = self
            .trees
            .iter()
            .flat_map(|tree| tree.nodes.iter())
            .filter(|node| node.status == NodeStatus::Completed)
            .count();
        let selected_id = self.selected_node_id.as_deref().unwrap_or("-");
        let mode = if self.storage_root.starts_with(DEFAULT_OBSIDIAN_VAULT) {
            "Obsidian vault"
        } else {
            "Local files"
        };

        ui.add_space(3.0);
        ui.horizontal(|ui| {
            ui.colored_label(ACCENT, "*");
            ui.label(egui::RichText::new(mode).monospace().color(FG2).size(11.0));
            ui.separator();
            ui.label(
                egui::RichText::new(format!(
                    "{} trees / {} nodes / {} forged",
                    self.trees.len(),
                    total_nodes,
                    total_done
                ))
                .monospace()
                .color(FG3)
                .size(11.0),
            );
            ui.separator();
            ui.label(
                egui::RichText::new(format!("selected {selected_id}"))
                    .monospace()
                    .color(FG3)
                    .size(11.0),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(&self.status_line)
                        .monospace()
                        .color(FG3)
                        .size(11.0),
                );
            });
        });
    }

    fn render_tree_rail(&mut self, ui: &mut egui::Ui) {
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, 0.0, BG2);
        ui.painter().line_segment(
            [rect.right_top(), rect.right_bottom()],
            egui::Stroke::new(1.0, BORDER1),
        );

        ui.add_space(8.0);
        ui.horizontal(|ui| {
            ui.add_space(8.0);
            ui.label(
                egui::RichText::new("TREES")
                    .monospace()
                    .color(FG3)
                    .size(11.0),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.add(toolbar_button("New")).clicked() {
                    self.create_tree();
                }
            });
        });

        ui.horizontal(|ui| {
            ui.add_space(8.0);
            ui.add_sized(
                [(ui.available_width() - 8.0).max(80.0), 24.0],
                egui::TextEdit::singleline(&mut self.new_tree_title).hint_text("New tree title"),
            );
        });

        ui.add_space(8.0);
        ui.horizontal(|ui| {
            ui.add_space(8.0);
            ui.add_sized(
                [(ui.available_width() - 8.0).max(80.0), 24.0],
                egui::TextEdit::singleline(&mut self.tree_filter).hint_text("Filter nodes"),
            );
        });

        ui.add_space(8.0);
        ui.separator();

        let parent_for_new = self.selected_node_id.clone();
        ui.horizontal(|ui| {
            ui.add_space(8.0);
            ui.add_sized(
                [(ui.available_width() - 96.0).max(80.0), 24.0],
                egui::TextEdit::singleline(&mut self.new_node_title).hint_text("New node title"),
            );
            if ui.add(toolbar_button("Root")).clicked() {
                self.create_node(None);
            }
            if ui.add(toolbar_button("Child")).clicked() {
                self.create_node(parent_for_new);
            }
        });

        ui.add_space(6.0);

        let mut next_tree = None;
        let mut next_node = None;
        let filter = self.tree_filter.trim().to_lowercase();

        egui::ScrollArea::vertical().show(ui, |ui| {
            for index in 0..self.trees.len() {
                let tree = &self.trees[index];
                let selected = Some(index) == self.selected_tree;
                let done = tree
                    .nodes
                    .iter()
                    .filter(|node| node.status == NodeStatus::Completed)
                    .count();
                let tree_label = format!(
                    "{}    {done}/{}",
                    truncate_label(&tree.title, 24),
                    tree.nodes.len()
                );
                let response = rail_row(ui, tree_label, selected, None, 0.0, 28.0);
                if response.clicked() {
                    next_tree = Some(index);
                }

                if selected {
                    let rows = node_rows(tree)
                        .into_iter()
                        .filter_map(|(node_id, depth)| {
                            tree.nodes
                                .iter()
                                .find(|node| node.id == node_id)
                                .map(|node| (node.clone(), depth))
                        })
                        .collect::<Vec<_>>();

                    for (node, depth) in rows {
                        if !filter.is_empty() && !node.title.to_lowercase().contains(&filter) {
                            continue;
                        }
                        let is_selected =
                            self.selected_node_id.as_deref() == Some(node.id.as_str());
                        let color = status_color(&node.status);
                        let max_chars = 26usize.saturating_sub(depth * 2).max(12);
                        let label = truncate_label(&node.title, max_chars);
                        let response = rail_row(
                            ui,
                            label,
                            is_selected,
                            Some(color),
                            (depth * 14) as f32,
                            25.0,
                        );
                        if response.clicked() {
                            next_node = Some(node.id);
                        }
                    }
                }
            }
        });

        if let Some(index) = next_tree {
            self.selected_tree = Some(index);
            let selected_exists = self
                .selected_node_id
                .as_deref()
                .is_some_and(|id| self.trees[index].nodes.iter().any(|node| node.id == id));
            if !selected_exists {
                self.selected_node_id = self.trees[index].nodes.first().map(|node| node.id.clone());
            }
        }
        if let Some(node_id) = next_node {
            self.selected_node_id = Some(node_id);
        }
    }

    fn render_canvas(&mut self, ui: &mut egui::Ui) {
        let rect = ui.available_rect_before_wrap();
        let response = ui.allocate_rect(rect, egui::Sense::click_and_drag());
        let painter = ui.painter_at(rect);
        draw_canvas_background(&painter, rect, self.canvas_offset, self.canvas_zoom);

        let Some(tree_index) = self.selected_tree else {
            draw_canvas_empty(&painter, rect, "Create a tree to start");
            return;
        };

        if response.hovered() {
            let zoom_delta = ui.input(|input| input.zoom_delta());
            if (zoom_delta - 1.0).abs() > 0.001 {
                self.canvas_zoom = (self.canvas_zoom * zoom_delta).clamp(0.35, 1.8);
            }

            let ctrl_scroll = ui.input(|input| {
                (input.modifiers.command || input.modifiers.ctrl)
                    && input.smooth_scroll_delta.y != 0.0
            });
            if ctrl_scroll {
                let delta = ui.input(|input| input.smooth_scroll_delta.y);
                self.canvas_zoom = (self.canvas_zoom * (1.0 + delta * 0.001)).clamp(0.35, 1.8);
            }
        }

        if response.dragged_by(egui::PointerButton::Middle) {
            self.canvas_offset += ui.input(|input| input.pointer.delta());
        }

        if response.double_clicked() {
            self.fit_canvas_to_rect(rect);
        }

        let nodes = self.trees[tree_index].nodes.clone();
        let edges = self.trees[tree_index].edges.clone();
        if nodes.is_empty() {
            draw_canvas_empty(&painter, rect, "No nodes yet");
            painter.text(
                rect.center() + egui::vec2(0.0, 28.0),
                egui::Align2::CENTER_CENTER,
                "Create a root node from the left rail",
                egui::FontId::proportional(12.0),
                FG3,
            );
            return;
        }

        let by_id = nodes
            .iter()
            .map(|node| (node.id.as_str(), node))
            .collect::<HashMap<_, _>>();
        for edge in &edges {
            let Some(source) = by_id.get(edge.source_node_id.as_str()) else {
                continue;
            };
            let Some(target) = by_id.get(edge.target_node_id.as_str()) else {
                continue;
            };
            let from = world_to_screen(
                rect,
                self.canvas_offset,
                self.canvas_zoom,
                egui::vec2(
                    source.position_x + NODE_COLUMN_WIDTH / 2.0,
                    source.position_y + NODE_ORB_CENTER_Y,
                ),
            );
            let to = world_to_screen(
                rect,
                self.canvas_offset,
                self.canvas_zoom,
                egui::vec2(
                    target.position_x + NODE_COLUMN_WIDTH / 2.0,
                    target.position_y + NODE_ORB_CENTER_Y,
                ),
            );
            let lit = source.status == NodeStatus::Completed && target.status != NodeStatus::Locked
                || self.selected_node_id.as_deref() == Some(source.id.as_str())
                || self.selected_node_id.as_deref() == Some(target.id.as_str());
            draw_canvas_edge(&painter, from, to, &edge.r#type, lit);
        }

        let mut next_node = None;
        let mut moved_node: Option<(String, egui::Vec2)> = None;
        for node in &nodes {
            let center = world_to_screen(
                rect,
                self.canvas_offset,
                self.canvas_zoom,
                egui::vec2(
                    node.position_x + NODE_COLUMN_WIDTH / 2.0,
                    node.position_y + NODE_ORB_CENTER_Y,
                ),
            );
            let interact_rect = egui::Rect::from_center_size(
                center + egui::vec2(0.0, 22.0 * self.canvas_zoom),
                egui::vec2(220.0, NODE_INTERACT_HEIGHT) * self.canvas_zoom,
            );
            let node_response = ui.interact(
                interact_rect,
                ui.id().with(("canvas-node", &node.id)),
                egui::Sense::click_and_drag(),
            );
            let selected = self.selected_node_id.as_deref() == Some(node.id.as_str());
            draw_canvas_node(&painter, node, selected, center, self.canvas_zoom);

            if node_response.clicked() {
                next_node = Some(node.id.clone());
            }
            if node_response.dragged() {
                let delta = ui.input(|input| input.pointer.delta()) / self.canvas_zoom;
                if delta != egui::Vec2::ZERO {
                    moved_node = Some((node.id.clone(), delta));
                }
            }
        }

        if let Some((node_id, delta)) = moved_node {
            if let Some(node) = self.trees[tree_index]
                .nodes
                .iter_mut()
                .find(|node| node.id == node_id)
            {
                node.position_x += delta.x;
                node.position_y += delta.y;
                self.selected_node_id = Some(node.id.clone());
                self.status_line = "Moved node. Save to persist layout.".to_string();
            }
        } else if let Some(node_id) = next_node {
            self.selected_node_id = Some(node_id);
        } else if response.clicked() {
            self.selected_node_id = None;
        }

        painter.text(
            rect.left_bottom() + egui::vec2(12.0, -16.0),
            egui::Align2::LEFT_CENTER,
            "drag nodes / middle-drag pan / ctrl+scroll zoom / double-click fit",
            egui::FontId::monospace(10.0),
            FG3,
        );
        painter.text(
            rect.right_bottom() + egui::vec2(-12.0, -16.0),
            egui::Align2::RIGHT_CENTER,
            format!("{:.0}%", self.canvas_zoom * 100.0),
            egui::FontId::monospace(10.0),
            FG3,
        );
        self.render_canvas_overlays(ui, rect, &nodes, &edges);
    }

    fn render_canvas_overlays(
        &mut self,
        ui: &mut egui::Ui,
        canvas_rect: egui::Rect,
        nodes: &[SkillNode],
        edges: &[SkillEdge],
    ) {
        if nodes.is_empty() {
            return;
        }

        let painter = ui.painter();
        let mini_rect = egui::Rect::from_min_size(
            canvas_rect.right_top() + egui::vec2(-172.0, 12.0),
            egui::vec2(160.0, 110.0),
        );
        painter.rect_filled(
            mini_rect,
            4.0,
            egui::Color32::from_rgba_unmultiplied(10, 14, 22, 225),
        );
        painter.rect_stroke(
            mini_rect,
            4.0,
            egui::Stroke::new(1.0, BORDER2),
            egui::StrokeKind::Middle,
        );

        let bounds = world_bounds(nodes);
        let scale = ((mini_rect.width() - 16.0) / bounds.width().max(1.0))
            .min((mini_rect.height() - 16.0) / bounds.height().max(1.0));
        let map_point = |world: egui::Vec2| -> egui::Pos2 {
            mini_rect.left_top()
                + egui::vec2(8.0, 8.0)
                + egui::vec2(world.x - bounds.min.x, world.y - bounds.min.y) * scale
        };
        let by_id = nodes
            .iter()
            .map(|node| (node.id.as_str(), node))
            .collect::<HashMap<_, _>>();
        for edge in edges {
            let Some(source) = by_id.get(edge.source_node_id.as_str()) else {
                continue;
            };
            let Some(target) = by_id.get(edge.target_node_id.as_str()) else {
                continue;
            };
            painter.line_segment(
                [
                    map_point(egui::vec2(
                        source.position_x + NODE_COLUMN_WIDTH / 2.0,
                        source.position_y + NODE_ORB_CENTER_Y,
                    )),
                    map_point(egui::vec2(
                        target.position_x + NODE_COLUMN_WIDTH / 2.0,
                        target.position_y + NODE_ORB_CENTER_Y,
                    )),
                ],
                egui::Stroke::new(0.8, BORDER2),
            );
        }
        for node in nodes {
            let point = map_point(egui::vec2(
                node.position_x + NODE_COLUMN_WIDTH / 2.0,
                node.position_y + NODE_ORB_CENTER_Y,
            ));
            painter.circle_filled(
                point,
                if self.selected_node_id.as_deref() == Some(node.id.as_str()) {
                    2.8
                } else {
                    1.8
                },
                status_color(&node.status),
            );
        }

        let mini_response = ui.interact(
            mini_rect,
            ui.id().with("canvas-mini-map"),
            egui::Sense::click(),
        );
        if mini_response.clicked() {
            if let Some(pos) = mini_response.interact_pointer_pos() {
                let world = bounds.min.to_vec2()
                    + (pos - mini_rect.left_top() - egui::vec2(8.0, 8.0)) / scale;
                self.canvas_offset = canvas_rect.size() * 0.5 - world * self.canvas_zoom;
            }
        }

        let controls = egui::Rect::from_min_size(
            canvas_rect.right_bottom() + egui::vec2(-150.0, -52.0),
            egui::vec2(138.0, 30.0),
        );
        painter.rect_filled(
            controls,
            4.0,
            egui::Color32::from_rgba_unmultiplied(10, 14, 22, 225),
        );
        painter.rect_stroke(
            controls,
            4.0,
            egui::Stroke::new(1.0, BORDER2),
            egui::StrokeKind::Middle,
        );

        let button_w = 30.0;
        let minus =
            egui::Rect::from_min_size(controls.min, egui::vec2(button_w, controls.height()));
        let fit = minus.translate(egui::vec2(button_w, 0.0));
        let plus = fit.translate(egui::vec2(button_w, 0.0));
        let label_rect =
            egui::Rect::from_min_max(controls.min + egui::vec2(button_w * 3.0, 0.0), controls.max);
        for (rect, label, id) in [
            (minus, "-", "zoom-out"),
            (fit, "fit", "fit"),
            (plus, "+", "zoom-in"),
        ] {
            let response = ui.interact(rect, ui.id().with(id), egui::Sense::click());
            if response.hovered() {
                painter.rect_filled(rect.shrink(2.0), 3.0, BG3);
            }
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                label,
                egui::FontId::monospace(11.0),
                if response.hovered() { FG1 } else { FG2 },
            );
            if response.clicked() {
                match id {
                    "zoom-out" => self.canvas_zoom = (self.canvas_zoom - 0.1).max(0.35),
                    "fit" => self.fit_canvas_to_rect(canvas_rect),
                    "zoom-in" => self.canvas_zoom = (self.canvas_zoom + 0.1).min(1.8),
                    _ => {}
                }
            }
        }
        painter.text(
            label_rect.center(),
            egui::Align2::CENTER_CENTER,
            format!("{:.0}%", self.canvas_zoom * 100.0),
            egui::FontId::monospace(10.0),
            FG3,
        );
    }

    fn fit_canvas_to_rect(&mut self, rect: egui::Rect) {
        let Some(tree) = self.selected_tree_ref() else {
            return;
        };
        if tree.nodes.is_empty() {
            return;
        }

        let min_x = tree
            .nodes
            .iter()
            .map(|node| node.position_x)
            .fold(f32::INFINITY, f32::min);
        let min_y = tree
            .nodes
            .iter()
            .map(|node| node.position_y)
            .fold(f32::INFINITY, f32::min);
        let max_x = tree
            .nodes
            .iter()
            .map(|node| node.position_x + NODE_COLUMN_WIDTH)
            .fold(f32::NEG_INFINITY, f32::max);
        let max_y = tree
            .nodes
            .iter()
            .map(|node| node.position_y + NODE_INTERACT_HEIGHT)
            .fold(f32::NEG_INFINITY, f32::max);
        let world_width = (max_x - min_x).max(1.0);
        let world_height = (max_y - min_y).max(1.0);
        let zoom = (rect.width() / (world_width + 180.0))
            .min(rect.height() / (world_height + 180.0))
            .clamp(0.35, 1.05);
        let world_center = egui::vec2((min_x + max_x) * 0.5, (min_y + max_y) * 0.5);
        self.canvas_zoom = zoom;
        self.canvas_offset = rect.size() * 0.5 - world_center * zoom;
    }

    fn render_inspector(&mut self, ui: &mut egui::Ui) {
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, 0.0, BG2);
        ui.painter().line_segment(
            [rect.left_top(), rect.left_bottom()],
            egui::Stroke::new(1.0, BORDER1),
        );

        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.add_space(10.0);
            self.render_inspector_content(ui);
        });
    }

    fn render_inspector_content(&mut self, ui: &mut egui::Ui) {
        let Some(tree_index) = self.selected_tree else {
            ui.vertical_centered(|ui| {
                ui.add_space(120.0);
                ui.heading("Create a tree to start.");
                ui.label(egui::RichText::new("Local files stay readable in Obsidian.").color(FG3));
            });
            return;
        };

        let selected_node_id = self.selected_node_id.clone();
        ui.label(
            egui::RichText::new("INSPECTOR")
                .monospace()
                .color(FG3)
                .size(11.0),
        );
        ui.horizontal(|ui| {
            ui.heading(self.trees[tree_index].title.clone());
            if ui.add(toolbar_button("Open folder")).clicked() {
                let _ = opener::open(&self.trees[tree_index].folder);
            }
        });
        ui.separator();

        ui.collapsing("Tree metadata", |ui| {
            ui.label("Title");
            ui.text_edit_singleline(&mut self.trees[tree_index].title);
            ui.label("Description");
            let description = self.trees[tree_index]
                .description
                .get_or_insert_with(String::new);
            ui.add(egui::TextEdit::multiline(description).desired_rows(3));
        });

        let Some(node_id) = selected_node_id else {
            ui.vertical_centered(|ui| {
                ui.add_space(120.0);
                ui.heading("No node selected");
                ui.label(
                    egui::RichText::new("Click an orb on the canvas to inspect it.").color(FG3),
                );
            });
            return;
        };

        let Some(node_index) = self.trees[tree_index]
            .nodes
            .iter()
            .position(|node| node.id == node_id)
        else {
            ui.label("Node not found.");
            return;
        };

        ui.separator();
        let node_title = self.trees[tree_index].nodes[node_index].title.clone();
        let node_status = self.trees[tree_index].nodes[node_index].status.clone();
        let node_status_color = status_color(&node_status);
        ui.horizontal(|ui| {
            ui.colored_label(node_status_color, "*");
            ui.label(
                egui::RichText::new(node_status.label())
                    .monospace()
                    .color(node_status_color)
                    .size(11.0),
            );
        });
        ui.heading(&node_title);
        let mut open_note = false;
        let mut save_tree = false;
        ui.horizontal(|ui| {
            if ui.add(toolbar_button("Open note")).clicked() {
                open_note = true;
            }
            if ui.add(primary_toolbar_button("Save")).clicked() {
                save_tree = true;
            }
        });

        {
            let node = &mut self.trees[tree_index].nodes[node_index];

            ui.label("Title");
            ui.text_edit_singleline(&mut node.title);

            ui.horizontal(|ui| {
                ui.label("Status");
                egui::ComboBox::from_id_salt("status_combo")
                    .selected_text(node.status.label())
                    .show_ui(ui, |ui| {
                        ui.selectable_value(
                            &mut node.status,
                            NodeStatus::Locked,
                            NodeStatus::Locked.label(),
                        );
                        ui.selectable_value(
                            &mut node.status,
                            NodeStatus::Available,
                            NodeStatus::Available.label(),
                        );
                        ui.selectable_value(
                            &mut node.status,
                            NodeStatus::InProgress,
                            NodeStatus::InProgress.label(),
                        );
                        ui.selectable_value(
                            &mut node.status,
                            NodeStatus::Completed,
                            NodeStatus::Completed.label(),
                        );
                    });

                ui.label("Difficulty");
                ui.add(egui::Slider::new(&mut node.difficulty, 1..=5));
                ui.label("Progress");
                ui.add(egui::Slider::new(&mut node.progress, 0..=100).suffix("%"));
            });
            let node_color = status_color(&node.status);
            ui.add(
                egui::ProgressBar::new(node.progress as f32 / 100.0)
                    .fill(node_color)
                    .text(format!("{}%", node.progress)),
            );

            ui.label("Description");
            let description = node.description.get_or_insert_with(String::new);
            ui.add(egui::TextEdit::multiline(description).desired_rows(4));

            ui.label("Notes");
            let notes = node.notes.get_or_insert_with(String::new);
            ui.add(egui::TextEdit::multiline(notes).desired_rows(8));

            ui.separator();
            ui.heading("Subtasks");
            let mut remove_subtask: Option<usize> = None;
            for (index, task) in node.sub_tasks.iter_mut().enumerate() {
                ui.horizontal(|ui| {
                    ui.checkbox(&mut task.done, "");
                    ui.text_edit_singleline(&mut task.title);
                    if ui.button("Remove").clicked() {
                        remove_subtask = Some(index);
                    }
                });
            }
            if let Some(index) = remove_subtask {
                node.sub_tasks.remove(index);
            }
            ui.horizontal(|ui| {
                ui.text_edit_singleline(&mut self.new_subtask_title);
                if ui.button("Add subtask").clicked() {
                    let title = self.new_subtask_title.trim();
                    if !title.is_empty() {
                        node.sub_tasks.push(SubTask {
                            title: title.to_string(),
                            done: false,
                        });
                        self.new_subtask_title.clear();
                    }
                }
            });
            sync_progress_from_subtasks(node);

            ui.separator();
            ui.heading("Resources");
            let mut remove_resource: Option<usize> = None;
            for (index, resource) in node.resources.iter_mut().enumerate() {
                ui.horizontal(|ui| {
                    ui.text_edit_singleline(&mut resource.title);
                    ui.text_edit_singleline(&mut resource.url);
                    if ui.button("Open").clicked() {
                        let _ = opener::open(&resource.url);
                    }
                    if ui.button("Remove").clicked() {
                        remove_resource = Some(index);
                    }
                });
            }
            if let Some(index) = remove_resource {
                node.resources.remove(index);
            }
            ui.horizontal(|ui| {
                ui.text_edit_singleline(&mut self.new_resource_title);
                ui.text_edit_singleline(&mut self.new_resource_url);
                if ui.button("Add resource").clicked() {
                    let title = self.new_resource_title.trim();
                    let url = self.new_resource_url.trim();
                    if !title.is_empty() && !url.is_empty() {
                        node.resources.push(Resource {
                            title: title.to_string(),
                            url: url.to_string(),
                        });
                        self.new_resource_title.clear();
                        self.new_resource_url.clear();
                    }
                }
            });
        }

        ui.separator();
        ui.heading("Dependencies");
        let dependencies = self.trees[tree_index]
            .edges
            .iter()
            .filter(|edge| edge.target_node_id == node_id)
            .map(|edge| {
                let source = self.trees[tree_index]
                    .nodes
                    .iter()
                    .find(|candidate| candidate.id == edge.source_node_id)
                    .map(|candidate| candidate.title.as_str())
                    .unwrap_or(edge.source_node_id.as_str());
                format!("{:?}: {}", edge.r#type, source)
            })
            .collect::<Vec<_>>();
        if dependencies.is_empty() {
            ui.label("No dependencies.");
        } else {
            for dependency in dependencies {
                ui.label(dependency);
            }
        }

        if open_note {
            self.open_selected_node_note();
        }
        if save_tree {
            self.save_selected_tree();
        }
    }
}

fn load_trees(storage_root: &Path) -> Result<Vec<SkillTree>> {
    fs::create_dir_all(storage_root)
        .with_context(|| format!("Could not create {}", storage_root.display()))?;

    let mut trees = Vec::new();
    for entry in WalkDir::new(storage_root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && entry.file_name() == MANIFEST_FILE)
    {
        match read_tree_from_manifest(storage_root, entry.path()) {
            Ok(tree) => trees.push(tree),
            Err(error) => eprintln!("Failed to read {}: {error:#}", entry.path().display()),
        }
    }
    trees.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(trees)
}

fn read_tree_from_manifest(storage_root: &Path, manifest_path: &Path) -> Result<SkillTree> {
    let raw = fs::read_to_string(manifest_path)?;
    let manifest: Manifest = serde_json::from_str(&raw)?;
    let folder = manifest_path.parent().unwrap_or(storage_root).to_path_buf();
    let tree_id = manifest
        .obsidian
        .as_ref()
        .map(|meta| meta.app_tree_id.clone())
        .unwrap_or_else(|| {
            format!(
                "local-{}",
                stable_hash(&manifest_path.display().to_string())
            )
        });
    let user_id = manifest
        .obsidian
        .as_ref()
        .map(|meta| meta.app_user_id.clone())
        .unwrap_or_else(|| "local-desktop".to_string());

    let mut tree = SkillTree {
        id: tree_id.clone(),
        user_id,
        title: manifest.tree.title,
        description: manifest.tree.description,
        slug: manifest.tree.slug,
        is_public: manifest.tree.is_public,
        share_mode: manifest.tree.share_mode,
        theme: manifest.tree.theme,
        canvas_state: manifest.tree.canvas_state,
        nodes: manifest
            .nodes
            .into_iter()
            .map(|mut node| {
                node.tree_id = tree_id.clone();
                node
            })
            .collect(),
        edges: manifest
            .edges
            .into_iter()
            .map(|mut edge| {
                edge.tree_id = tree_id.clone();
                edge
            })
            .collect(),
        folder,
    };

    let tree_note_path = manifest_path
        .parent()
        .unwrap_or(storage_root)
        .join(TREE_NOTE_FILE);
    if let Ok(markdown) = fs::read_to_string(&tree_note_path) {
        apply_tree_note(&mut tree, &markdown);
    }

    let mut note_paths = HashSet::new();
    if let Some(obsidian) = manifest.obsidian {
        for relative in obsidian.node_paths.values() {
            let path = if Path::new(relative).is_absolute() {
                PathBuf::from(relative)
            } else {
                storage_root
                    .parent()
                    .map(|vault| vault.join(relative))
                    .unwrap_or_else(|| storage_root.join(relative))
            };
            note_paths.insert(path);
        }
    }
    for entry in WalkDir::new(&tree.folder)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        if entry.path().extension().and_then(|ext| ext.to_str()) == Some("md")
            && entry.path().file_name().and_then(|name| name.to_str()) != Some(TREE_NOTE_FILE)
        {
            note_paths.insert(entry.path().to_path_buf());
        }
    }

    let mut nodes_by_id = tree
        .nodes
        .iter()
        .cloned()
        .map(|node| (node.id.clone(), node))
        .collect::<HashMap<_, _>>();
    let mut parsed_notes = Vec::new();
    for note_path in note_paths {
        let Ok(markdown) = fs::read_to_string(&note_path) else {
            continue;
        };
        let existing =
            read_node_id_from_markdown(&markdown).and_then(|id| nodes_by_id.get(&id).cloned());
        if let Some(parsed) = parse_node_note(&markdown, existing.as_ref(), &tree.id) {
            nodes_by_id.insert(parsed.node.id.clone(), parsed.node.clone());
            parsed_notes.push(parsed);
        }
    }

    if !parsed_notes.is_empty() {
        let order = tree
            .nodes
            .iter()
            .enumerate()
            .map(|(index, node)| (node.id.clone(), index))
            .collect::<HashMap<_, _>>();
        let mut nodes = nodes_by_id.into_values().collect::<Vec<_>>();
        nodes.sort_by(|a, b| {
            order
                .get(&a.id)
                .unwrap_or(&usize::MAX)
                .cmp(order.get(&b.id).unwrap_or(&usize::MAX))
                .then_with(|| a.title.cmp(&b.title))
        });
        tree.nodes = nodes;
    }

    if parsed_notes.iter().any(|note| note.has_dependency_metadata) {
        tree.edges = build_edges_from_node_notes(&tree.id, &parsed_notes);
    }

    Ok(tree)
}

fn write_tree(storage_root: &Path, tree: &mut SkillTree) -> Result<()> {
    let tree_folder = storage_root.join(slugify(&tree.slug, &tree.id));
    fs::create_dir_all(&tree_folder)?;
    tree.folder = tree_folder.clone();

    let node_paths = build_node_paths(storage_root, tree);
    fs::write(tree_folder.join(TREE_NOTE_FILE), render_tree_note(tree))?;

    for node in &tree.nodes {
        if let Some(path) = node_paths.get(&node.id) {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(path, render_node_note(tree, node))?;
        }
    }

    let manifest = build_manifest(storage_root, tree, &node_paths);
    fs::write(
        tree_folder.join(MANIFEST_FILE),
        format!("{}\n", serde_json::to_string_pretty(&manifest)?),
    )?;
    Ok(())
}

fn build_manifest(
    storage_root: &Path,
    tree: &SkillTree,
    node_paths: &HashMap<String, PathBuf>,
) -> Manifest {
    let node_paths = node_paths
        .iter()
        .map(|(id, path)| {
            (
                id.clone(),
                path.strip_prefix(storage_root.parent().unwrap_or(storage_root))
                    .unwrap_or(path)
                    .to_string_lossy()
                    .replace('\\', "/"),
            )
        })
        .collect::<HashMap<_, _>>();

    Manifest {
        version: 1,
        format: "backup".to_string(),
        tree: TreeMeta {
            title: tree.title.clone(),
            description: tree.description.clone(),
            theme: tree.theme.clone(),
            canvas_state: tree.canvas_state.clone(),
            slug: tree.slug.clone(),
            is_public: tree.is_public,
            share_mode: tree.share_mode.clone(),
        },
        nodes: tree.nodes.clone(),
        edges: tree.edges.clone(),
        obsidian: Some(ObsidianMeta {
            app_tree_id: tree.id.clone(),
            app_user_id: tree.user_id.clone(),
            root_folder: storage_root
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(DEFAULT_ROOT_FOLDER)
                .to_string(),
            tree_note_path: tree
                .folder
                .join(TREE_NOTE_FILE)
                .strip_prefix(storage_root.parent().unwrap_or(storage_root))
                .unwrap_or(&tree.folder.join(TREE_NOTE_FILE))
                .to_string_lossy()
                .replace('\\', "/"),
            node_paths,
            generated_at: Utc::now().to_rfc3339(),
        }),
    }
}

fn render_tree_note(tree: &SkillTree) -> String {
    format!(
        "{}# {}\n\n{}\n",
        render_frontmatter(&[
            ("skilltreeKind", json_string("tree")),
            ("treeId", json_string(&tree.id)),
            ("title", json_string(&tree.title)),
            ("slug", json_string(&tree.slug)),
            ("theme", json_string(&tree.theme)),
            ("shareMode", json_string("private")),
            ("isPublic", "false".to_string()),
            (
                "canvasStateJson",
                tree.canvas_state
                    .as_ref()
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "null".to_string()),
            ),
        ]),
        tree.title,
        tree.description.clone().unwrap_or_default()
    )
}

fn render_node_note(tree: &SkillTree, node: &SkillNode) -> String {
    let deps = node_dependencies(&tree.edges, &node.id);
    let subtasks = if node.sub_tasks.is_empty() {
        String::new()
    } else {
        node.sub_tasks
            .iter()
            .map(|task| format!("- [{}] {}", if task.done { "x" } else { " " }, task.title))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let resources = if node.resources.is_empty() {
        String::new()
    } else {
        node.resources
            .iter()
            .map(|resource| format!("- [{}]({})", resource.title, resource.url))
            .collect::<Vec<_>>()
            .join("\n")
    };

    format!(
        "{}# {}\n\n{}\n\n## Subtasks\n\n{}\n\n## Notes\n\n{}\n\n## Resources\n\n{}\n",
        render_frontmatter(&[
            ("skilltreeKind", json_string("node")),
            ("treeId", json_string(&tree.id)),
            ("nodeId", json_string(&node.id)),
            ("parentId", optional_json_string(node.parent_id.as_deref())),
            ("title", json_string(&node.title)),
            (
                "status",
                json_string(
                    serde_json::to_value(&node.status)
                        .unwrap()
                        .as_str()
                        .unwrap_or("available")
                )
            ),
            ("difficulty", node.difficulty.to_string()),
            (
                "estimatedHours",
                node.estimated_hours
                    .map(|hours| hours.to_string())
                    .unwrap_or_else(|| "null".to_string()),
            ),
            ("progress", node.progress.to_string()),
            ("positionX", node.position_x.to_string()),
            ("positionY", node.position_y.to_string()),
            (
                "subTreeId",
                optional_json_string(node.sub_tree_id.as_deref())
            ),
            (
                "requires",
                serde_json::to_string(&deps.prerequisite).unwrap()
            ),
            (
                "recommended",
                serde_json::to_string(&deps.recommended).unwrap()
            ),
            ("optional", serde_json::to_string(&deps.optional).unwrap()),
            (
                "styleJson",
                node.style
                    .as_ref()
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "null".to_string()),
            ),
        ]),
        node.title,
        node.description.clone().unwrap_or_default(),
        subtasks,
        node.notes.clone().unwrap_or_default(),
        resources
    )
}

fn render_frontmatter(entries: &[(&str, String)]) -> String {
    let mut out = String::from("---\n");
    for (key, value) in entries {
        out.push_str(key);
        out.push_str(": ");
        out.push_str(value);
        out.push('\n');
    }
    out.push_str("---\n\n");
    out
}

fn apply_tree_note(tree: &mut SkillTree, markdown: &str) {
    let (frontmatter, body) = parse_markdown_document(markdown);
    if let Some(title) = frontmatter.get("title").and_then(jsonish_to_string) {
        tree.title = title;
    } else if let Some(title) = first_heading(&body) {
        tree.title = title;
    }
    if let Some(description) = body_before_sections(&body) {
        tree.description = Some(description);
    }
}

fn parse_node_note(
    markdown: &str,
    existing: Option<&SkillNode>,
    tree_id: &str,
) -> Option<ParsedNodeNote> {
    let (frontmatter, body) = parse_markdown_document(markdown);
    let kind = frontmatter
        .get("skilltreeKind")
        .and_then(jsonish_to_string)?;
    if kind != "node" {
        return None;
    }

    let sub_tasks = parse_subtasks(section(&body, "Subtasks").as_deref()).unwrap_or_else(|| {
        existing
            .map(|node| node.sub_tasks.clone())
            .unwrap_or_default()
    });
    let resources = parse_resources(section(&body, "Resources").as_deref()).unwrap_or_else(|| {
        existing
            .map(|node| node.resources.clone())
            .unwrap_or_default()
    });
    let progress = frontmatter
        .get("progress")
        .and_then(jsonish_to_u8)
        .or_else(|| existing.map(|node| node.progress))
        .unwrap_or_else(|| progress_from_subtasks(&sub_tasks));

    let dependencies = HashMap::from([
        (
            EdgeTypeKey::Prerequisite,
            frontmatter
                .get("requires")
                .and_then(jsonish_to_string_array)
                .unwrap_or_default(),
        ),
        (
            EdgeTypeKey::Recommended,
            frontmatter
                .get("recommended")
                .and_then(jsonish_to_string_array)
                .unwrap_or_default(),
        ),
        (
            EdgeTypeKey::Optional,
            frontmatter
                .get("optional")
                .and_then(jsonish_to_string_array)
                .unwrap_or_default(),
        ),
    ]);

    let node = SkillNode {
        tree_id: tree_id.to_string(),
        id: frontmatter
            .get("nodeId")
            .and_then(jsonish_to_string)
            .or_else(|| existing.map(|node| node.id.clone()))
            .unwrap_or_else(|| format!("node-{}", stable_hash(markdown))),
        parent_id: frontmatter
            .get("parentId")
            .and_then(jsonish_to_string)
            .or_else(|| existing.and_then(|node| node.parent_id.clone())),
        title: frontmatter
            .get("title")
            .and_then(jsonish_to_string)
            .or_else(|| first_heading(&body))
            .or_else(|| existing.map(|node| node.title.clone()))
            .unwrap_or_else(|| "Untitled Skill".to_string()),
        description: body_before_sections(&body)
            .or_else(|| existing.and_then(|node| node.description.clone())),
        difficulty: frontmatter
            .get("difficulty")
            .and_then(jsonish_to_u8)
            .or_else(|| existing.map(|node| node.difficulty))
            .unwrap_or(1),
        estimated_hours: frontmatter
            .get("estimatedHours")
            .and_then(jsonish_to_f32)
            .or_else(|| existing.and_then(|node| node.estimated_hours)),
        progress,
        status: frontmatter
            .get("status")
            .and_then(jsonish_to_string)
            .and_then(|value| {
                serde_json::from_value::<NodeStatus>(serde_json::Value::String(value)).ok()
            })
            .or_else(|| existing.map(|node| node.status.clone()))
            .unwrap_or_default(),
        position_x: frontmatter
            .get("positionX")
            .and_then(jsonish_to_f32)
            .or_else(|| existing.map(|node| node.position_x))
            .unwrap_or_default(),
        position_y: frontmatter
            .get("positionY")
            .and_then(jsonish_to_f32)
            .or_else(|| existing.map(|node| node.position_y))
            .unwrap_or_default(),
        style: existing.and_then(|node| node.style.clone()),
        sub_tasks,
        resources,
        notes: section(&body, "Notes").or_else(|| existing.and_then(|node| node.notes.clone())),
        sub_tree_id: frontmatter
            .get("subTreeId")
            .and_then(jsonish_to_string)
            .or_else(|| existing.and_then(|node| node.sub_tree_id.clone())),
    };

    let has_dependency_metadata = frontmatter.contains_key("requires")
        || frontmatter.contains_key("recommended")
        || frontmatter.contains_key("optional");

    Some(ParsedNodeNote {
        node,
        dependencies,
        has_dependency_metadata,
    })
}

fn parse_markdown_document(markdown: &str) -> (HashMap<String, serde_json::Value>, String) {
    let normalized = markdown.replace("\r\n", "\n");
    if !normalized.starts_with("---\n") {
        return (HashMap::new(), normalized);
    }
    let Some(end) = normalized[4..].find("\n---") else {
        return (HashMap::new(), normalized);
    };
    let end = end + 4;
    let frontmatter = &normalized[4..end];
    let body = normalized[end + 4..].trim_start_matches('\n').to_string();
    (parse_frontmatter(frontmatter), body)
}

fn parse_frontmatter(frontmatter: &str) -> HashMap<String, serde_json::Value> {
    frontmatter
        .lines()
        .filter_map(|line| {
            let (key, raw) = line.split_once(':')?;
            let raw = raw.trim();
            let value = if raw == "null" || raw == "~" || raw.is_empty() {
                serde_json::Value::Null
            } else if raw == "true" || raw == "false" {
                serde_json::Value::Bool(raw == "true")
            } else if let Ok(number) = raw.parse::<f64>() {
                serde_json::Number::from_f64(number)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            } else if raw.starts_with('"') || raw.starts_with('[') || raw.starts_with('{') {
                serde_json::from_str(raw).unwrap_or_else(|_| {
                    serde_json::Value::String(raw.trim_matches('"').to_string())
                })
            } else {
                serde_json::Value::String(raw.to_string())
            };
            Some((key.trim().to_string(), value))
        })
        .collect()
}

fn first_heading(body: &str) -> Option<String> {
    body.lines()
        .find_map(|line| {
            line.strip_prefix("# ")
                .map(|title| title.trim().to_string())
        })
        .filter(|title| !title.is_empty())
}

fn body_before_sections(body: &str) -> Option<String> {
    let without_heading = body
        .strip_prefix("# ")
        .and_then(|rest| rest.split_once('\n').map(|(_, after)| after))
        .unwrap_or(body);
    without_heading
        .split("\n## ")
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn section(body: &str, title: &str) -> Option<String> {
    let marker = format!("## {title}");
    let start = body.find(&marker)?;
    let rest = &body[start + marker.len()..];
    let rest = rest.trim_start_matches(['\r', '\n']);
    let end = rest.find("\n## ").unwrap_or(rest.len());
    Some(rest[..end].trim().to_string()).filter(|value| !value.is_empty())
}

fn parse_subtasks(section: Option<&str>) -> Option<Vec<SubTask>> {
    let section = section?;
    Some(
        section
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim();
                let rest = trimmed.strip_prefix("- [")?;
                let (done, title) = rest.split_once("] ")?;
                Some(SubTask {
                    done: done.eq_ignore_ascii_case("x"),
                    title: title.trim().to_string(),
                })
            })
            .collect(),
    )
}

fn parse_resources(section: Option<&str>) -> Option<Vec<Resource>> {
    let section = section?;
    Some(
        section
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim().strip_prefix("- [")?;
                let (title, rest) = trimmed.split_once("](")?;
                let url = rest.strip_suffix(')')?;
                Some(Resource {
                    title: title.trim().to_string(),
                    url: url.trim().to_string(),
                })
            })
            .collect(),
    )
}

fn build_edges_from_node_notes(tree_id: &str, parsed_notes: &[ParsedNodeNote]) -> Vec<SkillEdge> {
    let node_ids = parsed_notes
        .iter()
        .map(|note| note.node.id.clone())
        .collect::<HashSet<_>>();
    let mut edges = HashMap::new();

    for note in parsed_notes {
        for (edge_type, sources) in &note.dependencies {
            for source in sources {
                if !node_ids.contains(source) {
                    continue;
                }
                let edge_type_value = edge_type.to_edge_type();
                let key = format!("{source}->{}:{:?}", note.node.id, edge_type_value);
                edges.insert(
                    key.clone(),
                    SkillEdge {
                        tree_id: tree_id.to_string(),
                        id: format!("edge-{}", stable_hash(&key)),
                        source_node_id: source.clone(),
                        target_node_id: note.node.id.clone(),
                        r#type: edge_type_value,
                        style: None,
                    },
                );
            }
        }
    }

    edges.into_values().collect()
}

fn build_node_paths(storage_root: &Path, tree: &SkillTree) -> HashMap<String, PathBuf> {
    let tree_folder = storage_root.join(slugify(&tree.slug, &tree.id));
    let parent_by_node = folder_parent_map(tree);
    let mut children: HashMap<Option<String>, Vec<&SkillNode>> = HashMap::new();
    for node in &tree.nodes {
        children
            .entry(parent_by_node.get(&node.id).cloned().flatten())
            .or_default()
            .push(node);
    }
    for siblings in children.values_mut() {
        siblings.sort_by(|a, b| compare_nodes(a, b));
    }

    let mut segments = HashMap::new();
    for siblings in children.values() {
        for (index, node) in siblings.iter().enumerate() {
            segments.insert(
                node.id.clone(),
                format!("{:02}-{}", index + 1, slugify(&node.title, &node.id)),
            );
        }
    }

    let mut paths = HashMap::new();
    for node in &tree.nodes {
        let mut parts = parent_parts(&node.id, &parent_by_node, &segments);
        parts.push(
            segments
                .get(&node.id)
                .cloned()
                .unwrap_or_else(|| slugify(&node.title, &node.id)),
        );
        let mut path = tree_folder.clone();
        for (index, part) in parts.iter().enumerate() {
            if index == parts.len() - 1 {
                path.push(format!("{part}.md"));
            } else {
                path.push(part);
            }
        }
        paths.insert(node.id.clone(), path);
    }
    paths
}

fn folder_parent_map(tree: &SkillTree) -> HashMap<String, Option<String>> {
    let node_ids = tree
        .nodes
        .iter()
        .map(|node| node.id.clone())
        .collect::<HashSet<_>>();
    let mut incoming: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &tree.edges {
        if edge.r#type == EdgeType::Prerequisite {
            incoming
                .entry(edge.target_node_id.clone())
                .or_default()
                .push(edge.source_node_id.clone());
        }
    }
    let mut parent_by_node = HashMap::new();
    for node in &tree.nodes {
        if let Some(parent_id) = &node.parent_id {
            if node_ids.contains(parent_id) {
                parent_by_node.insert(node.id.clone(), Some(parent_id.clone()));
                continue;
            }
        }
        let inferred = incoming.get(&node.id).and_then(|sources| {
            sources
                .iter()
                .find(|source| node_ids.contains(*source))
                .cloned()
        });
        parent_by_node.insert(node.id.clone(), inferred);
    }
    parent_by_node
}

fn parent_parts(
    node_id: &str,
    parent_by_node: &HashMap<String, Option<String>>,
    segments: &HashMap<String, String>,
) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = parent_by_node.get(node_id).cloned().flatten();
    let mut seen = HashSet::new();
    while let Some(parent_id) = current {
        if !seen.insert(parent_id.clone()) {
            break;
        }
        if let Some(segment) = segments.get(&parent_id) {
            parts.push(segment.clone());
        }
        current = parent_by_node.get(&parent_id).cloned().flatten();
    }
    parts.reverse();
    parts
}

fn node_rows(tree: &SkillTree) -> Vec<(String, usize)> {
    let parent_by_node = folder_parent_map(tree);
    let mut children: HashMap<Option<String>, Vec<&SkillNode>> = HashMap::new();
    for node in &tree.nodes {
        children
            .entry(parent_by_node.get(&node.id).cloned().flatten())
            .or_default()
            .push(node);
    }
    for siblings in children.values_mut() {
        siblings.sort_by(|a, b| compare_nodes(a, b));
    }

    let mut rows = Vec::new();
    append_rows(None, 0, &children, &mut rows);
    rows
}

fn append_rows(
    parent_id: Option<String>,
    depth: usize,
    children: &HashMap<Option<String>, Vec<&SkillNode>>,
    rows: &mut Vec<(String, usize)>,
) {
    if let Some(siblings) = children.get(&parent_id) {
        for node in siblings {
            rows.push((node.id.clone(), depth));
            append_rows(Some(node.id.clone()), depth + 1, children, rows);
        }
    }
}

fn node_dependencies(edges: &[SkillEdge], node_id: &str) -> NodeDependencyLists {
    NodeDependencyLists {
        prerequisite: edges
            .iter()
            .filter(|edge| edge.target_node_id == node_id && edge.r#type == EdgeType::Prerequisite)
            .map(|edge| edge.source_node_id.clone())
            .collect(),
        recommended: edges
            .iter()
            .filter(|edge| edge.target_node_id == node_id && edge.r#type == EdgeType::Recommended)
            .map(|edge| edge.source_node_id.clone())
            .collect(),
        optional: edges
            .iter()
            .filter(|edge| edge.target_node_id == node_id && edge.r#type == EdgeType::Optional)
            .map(|edge| edge.source_node_id.clone())
            .collect(),
    }
}

struct NodeDependencyLists {
    prerequisite: Vec<String>,
    recommended: Vec<String>,
    optional: Vec<String>,
}

fn sync_progress_from_subtasks(node: &mut SkillNode) {
    if node.sub_tasks.is_empty() {
        return;
    }
    node.progress = progress_from_subtasks(&node.sub_tasks);
    node.status = if node.progress >= 100 {
        NodeStatus::Completed
    } else if node.progress > 0 {
        NodeStatus::InProgress
    } else if node.status == NodeStatus::Completed || node.status == NodeStatus::InProgress {
        NodeStatus::Available
    } else {
        node.status.clone()
    };
}

fn progress_from_subtasks(subtasks: &[SubTask]) -> u8 {
    if subtasks.is_empty() {
        return 0;
    }
    ((subtasks.iter().filter(|task| task.done).count() * 100) / subtasks.len()) as u8
}

fn read_node_id_from_markdown(markdown: &str) -> Option<String> {
    let (frontmatter, _) = parse_markdown_document(markdown);
    frontmatter.get("nodeId").and_then(jsonish_to_string)
}

fn jsonish_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(value) if !value.trim().is_empty() => {
            Some(value.trim().to_string())
        }
        _ => None,
    }
}

fn jsonish_to_string_array(value: &serde_json::Value) -> Option<Vec<String>> {
    value.as_array().map(|items| {
        items
            .iter()
            .filter_map(jsonish_to_string)
            .collect::<Vec<_>>()
    })
}

fn jsonish_to_u8(value: &serde_json::Value) -> Option<u8> {
    value.as_u64().and_then(|value| u8::try_from(value).ok())
}

fn jsonish_to_f32(value: &serde_json::Value) -> Option<f32> {
    value.as_f64().map(|value| value as f32)
}

fn json_string(value: &str) -> String {
    serde_json::to_string(value).unwrap()
}

fn optional_json_string(value: Option<&str>) -> String {
    value.map(json_string).unwrap_or_else(|| "null".to_string())
}

fn default_storage_root() -> PathBuf {
    if let Ok(storage_root) = env::var("SKILLTREE_STORAGE_ROOT") {
        return PathBuf::from(storage_root);
    }

    if let Ok(vault_path) = env::var("OBSIDIAN_VAULT_PATH") {
        let root =
            env::var("SKILLTREE_OBSIDIAN_ROOT").unwrap_or_else(|_| DEFAULT_ROOT_FOLDER.to_string());
        return Path::new(&vault_path).join(root);
    }

    let obsidian_root = Path::new(DEFAULT_OBSIDIAN_VAULT).join(DEFAULT_ROOT_FOLDER);
    if obsidian_root.exists() || Path::new(DEFAULT_OBSIDIAN_VAULT).exists() {
        return obsidian_root;
    }

    ProjectDirs::from("local", "SkillTree", "SkillTree Local")
        .map(|dirs| dirs.data_dir().join(DEFAULT_ROOT_FOLDER))
        .unwrap_or_else(|| PathBuf::from(DEFAULT_ROOT_FOLDER))
}

fn start_update_check() -> Option<Receiver<String>> {
    if env::var("SKILLTREE_DISABLE_AUTO_UPDATE").as_deref() == Ok("1") {
        return None;
    }

    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send("Checking for updates...".to_string());
        let message = match run_auto_update() {
            Ok(UpdateOutcome::UpToDate(version)) => {
                format!("SkillTree Local is up to date ({version})")
            }
            Ok(UpdateOutcome::Updated(version)) => {
                format!("Updated to {version}. Restart SkillTree Local to use the new version.")
            }
            Err(error) => update_error_message(error),
        };
        let _ = tx.send(message);
    });

    Some(rx)
}

enum UpdateOutcome {
    UpToDate(String),
    Updated(String),
}

fn run_auto_update() -> Result<UpdateOutcome> {
    let mut builder = self_update::backends::github::Update::configure();
    builder
        .repo_owner(GITHUB_OWNER)
        .repo_name(GITHUB_REPO)
        .bin_name("skilltree-local")
        .show_download_progress(false)
        .show_output(false)
        .no_confirm(true)
        .current_version(env!("CARGO_PKG_VERSION"));

    if let Ok(token) = env::var("GITHUB_TOKEN") {
        if !token.trim().is_empty() {
            builder.auth_token(token.trim());
        }
    }

    let status = builder.build()?.update()?;
    match status {
        self_update::Status::UpToDate(version) => Ok(UpdateOutcome::UpToDate(version)),
        self_update::Status::Updated(version) => Ok(UpdateOutcome::Updated(version)),
    }
}

fn update_error_message(error: anyhow::Error) -> String {
    let error = error.to_string();
    if error.contains("No releases found") {
        return "No releases published yet.".to_string();
    }
    if error.contains("No asset found for target") {
        return "No compatible update asset found for this platform.".to_string();
    }
    format!("Update check failed: {error}")
}

fn apply_design_system(ctx: &egui::Context) {
    let mut visuals = egui::Visuals::dark();
    visuals.panel_fill = BG0;
    visuals.window_fill = BG2;
    visuals.faint_bg_color = BG1;
    visuals.extreme_bg_color = BG0;
    visuals.code_bg_color = BG1;
    visuals.hyperlink_color = ACCENT_2;
    visuals.selection.bg_fill = egui::Color32::from_rgba_unmultiplied(217, 178, 76, 42);
    visuals.selection.stroke = egui::Stroke::new(1.0, ACCENT);
    visuals.widgets.noninteractive.bg_fill = BG2;
    visuals.widgets.noninteractive.fg_stroke = egui::Stroke::new(1.0, FG2);
    visuals.widgets.inactive.bg_fill = BG2;
    visuals.widgets.inactive.bg_stroke = egui::Stroke::new(1.0, BORDER2);
    visuals.widgets.inactive.fg_stroke = egui::Stroke::new(1.0, FG2);
    visuals.widgets.hovered.bg_fill = BG3;
    visuals.widgets.hovered.bg_stroke = egui::Stroke::new(1.0, BORDER3);
    visuals.widgets.hovered.fg_stroke = egui::Stroke::new(1.0, FG1);
    visuals.widgets.active.bg_fill = BG4;
    visuals.widgets.active.bg_stroke = egui::Stroke::new(1.0, ACCENT);
    visuals.widgets.active.fg_stroke = egui::Stroke::new(1.0, FG1);
    visuals.override_text_color = Some(FG1);

    let mut style = (*ctx.style()).clone();
    style.visuals = visuals;
    style.spacing.item_spacing = egui::vec2(8.0, 6.0);
    style.spacing.button_padding = egui::vec2(8.0, 4.0);
    style.spacing.interact_size = egui::vec2(26.0, 24.0);
    style.text_styles.insert(
        egui::TextStyle::Heading,
        egui::FontId::new(19.0, egui::FontFamily::Proportional),
    );
    style.text_styles.insert(
        egui::TextStyle::Body,
        egui::FontId::new(13.0, egui::FontFamily::Proportional),
    );
    style.text_styles.insert(
        egui::TextStyle::Monospace,
        egui::FontId::new(11.0, egui::FontFamily::Monospace),
    );
    ctx.set_style(style);
}

fn toolbar_button(label: &'static str) -> egui::Button<'static> {
    egui::Button::new(egui::RichText::new(label).color(FG2).size(12.0))
        .fill(BG2)
        .stroke(egui::Stroke::new(1.0, BORDER2))
}

fn primary_toolbar_button(label: &'static str) -> egui::Button<'static> {
    egui::Button::new(
        egui::RichText::new(label)
            .color(ACCENT_2)
            .size(12.0)
            .strong(),
    )
    .fill(egui::Color32::from_rgb(42, 31, 11))
    .stroke(egui::Stroke::new(1.0, ACCENT))
}

fn rail_row(
    ui: &mut egui::Ui,
    label: String,
    selected: bool,
    dot: Option<egui::Color32>,
    indent: f32,
    height: f32,
) -> egui::Response {
    let width = ui.available_width().max(1.0);
    let (rect, response) = ui.allocate_exact_size(egui::vec2(width, height), egui::Sense::click());
    let fill = if selected {
        BG4
    } else if response.hovered() {
        BG3
    } else {
        BG2
    };
    ui.painter().rect_filled(rect, 0.0, fill);
    if selected {
        ui.painter().line_segment(
            [rect.left_top(), rect.left_bottom()],
            egui::Stroke::new(2.0, ACCENT),
        );
    }

    let mut text_x = rect.left() + 12.0 + indent;
    if let Some(dot_color) = dot {
        ui.painter()
            .circle_filled(egui::pos2(text_x + 3.0, rect.center().y), 3.0, dot_color);
        text_x += 14.0;
    }
    let text_color = if selected { FG1 } else { FG2 };
    ui.painter().text(
        egui::pos2(text_x, rect.center().y),
        egui::Align2::LEFT_CENTER,
        label,
        egui::FontId::monospace(12.0),
        text_color,
    );
    response
}

fn short_path(path: &Path, max_chars: usize) -> String {
    let value = path.display().to_string();
    if value.chars().count() <= max_chars {
        return value;
    }
    let tail = value
        .chars()
        .rev()
        .take(max_chars.saturating_sub(1))
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>();
    format!("...{tail}")
}

fn draw_canvas_background(
    painter: &egui::Painter,
    rect: egui::Rect,
    offset: egui::Vec2,
    zoom: f32,
) {
    painter.rect_filled(rect, 0.0, BG1);
    painter.circle_filled(
        rect.center(),
        rect.width().max(rect.height()) * 0.62,
        egui::Color32::from_rgba_unmultiplied(21, 32, 47, 185),
    );
    painter.rect_filled(
        rect,
        0.0,
        egui::Color32::from_rgba_unmultiplied(5, 8, 15, 110),
    );

    let grid = (72.0 * zoom).max(20.0);
    let mut x = rect.left() + offset.x.rem_euclid(grid);
    while x < rect.right() {
        let mut y = rect.top() + offset.y.rem_euclid(grid);
        while y < rect.bottom() {
            painter.circle_filled(
                egui::pos2(x, y),
                1.2,
                egui::Color32::from_rgba_unmultiplied(180, 150, 90, 28),
            );
            y += grid;
        }
        x += grid;
    }
}

fn draw_canvas_empty(painter: &egui::Painter, rect: egui::Rect, title: &str) {
    painter.circle_filled(
        rect.center() + egui::vec2(0.0, -20.0),
        26.0,
        egui::Color32::from_rgba_unmultiplied(35, 45, 64, 210),
    );
    painter.circle_stroke(
        rect.center() + egui::vec2(0.0, -20.0),
        26.0,
        egui::Stroke::new(1.0, BORDER2),
    );
    painter.text(
        rect.center() + egui::vec2(0.0, 24.0),
        egui::Align2::CENTER_CENTER,
        title,
        egui::FontId::proportional(16.0),
        FG2,
    );
}

fn world_to_screen(
    rect: egui::Rect,
    offset: egui::Vec2,
    zoom: f32,
    world: egui::Vec2,
) -> egui::Pos2 {
    rect.min + offset + world * zoom
}

fn world_bounds(nodes: &[SkillNode]) -> egui::Rect {
    let min_x = nodes
        .iter()
        .map(|node| node.position_x)
        .fold(f32::INFINITY, f32::min);
    let min_y = nodes
        .iter()
        .map(|node| node.position_y)
        .fold(f32::INFINITY, f32::min);
    let max_x = nodes
        .iter()
        .map(|node| node.position_x + NODE_COLUMN_WIDTH)
        .fold(f32::NEG_INFINITY, f32::max);
    let max_y = nodes
        .iter()
        .map(|node| node.position_y + NODE_INTERACT_HEIGHT)
        .fold(f32::NEG_INFINITY, f32::max);
    egui::Rect::from_min_max(egui::pos2(min_x, min_y), egui::pos2(max_x, max_y))
}

fn draw_canvas_edge(
    painter: &egui::Painter,
    from: egui::Pos2,
    to: egui::Pos2,
    edge_type: &EdgeType,
    lit: bool,
) {
    let color = if lit {
        ACCENT
    } else {
        match edge_type {
            EdgeType::Prerequisite => egui::Color32::from_rgb(62, 85, 119),
            EdgeType::Recommended => BORDER2,
            EdgeType::Optional => BORDER1,
        }
    };
    let width = if lit { 2.4 } else { 1.35 };
    let mid = egui::pos2((from.x + to.x) * 0.5, (from.y + to.y) * 0.5);
    let control = mid + egui::vec2(0.0, -((to.x - from.x).abs() * 0.04).min(42.0));
    let points = (0..=24)
        .map(|index| {
            let t = index as f32 / 24.0;
            let inv = 1.0 - t;
            let x = inv * inv * from.x + 2.0 * inv * t * control.x + t * t * to.x;
            let y = inv * inv * from.y + 2.0 * inv * t * control.y + t * t * to.y;
            egui::pos2(x, y)
        })
        .collect::<Vec<_>>();

    if lit {
        painter.line(
            points.clone(),
            egui::Stroke::new(5.0, egui::Color32::from_rgba_unmultiplied(217, 178, 76, 42)),
        );
    }
    painter.line(points, egui::Stroke::new(width, color));
}

fn draw_canvas_node(
    painter: &egui::Painter,
    node: &SkillNode,
    selected: bool,
    center: egui::Pos2,
    zoom: f32,
) {
    let status = status_color(&node.status);
    let is_keystone = node.difficulty >= 5;
    let size = if is_keystone { 92.0 } else { 76.0 } * zoom;
    let radius = size * 0.5;
    let fill = if selected { BG4 } else { BG2 };
    let inner = egui::Color32::from_rgb(13, 19, 30);

    if selected {
        painter.circle_filled(
            center,
            radius + 12.0 * zoom,
            egui::Color32::from_rgba_unmultiplied(status.r(), status.g(), status.b(), 36),
        );
    } else if node.status == NodeStatus::InProgress || node.status == NodeStatus::Completed {
        painter.circle_filled(
            center,
            radius + 8.0 * zoom,
            egui::Color32::from_rgba_unmultiplied(status.r(), status.g(), status.b(), 22),
        );
    }

    if is_keystone {
        let points = (0..6)
            .map(|index| {
                let angle = std::f32::consts::TAU / 6.0 * index as f32;
                center + egui::vec2(angle.cos() * radius, angle.sin() * radius)
            })
            .collect::<Vec<_>>();
        painter.add(egui::Shape::convex_polygon(
            points.clone(),
            fill,
            egui::Stroke::new(4.0 * zoom, status),
        ));
        painter.add(egui::Shape::closed_line(
            points,
            egui::Stroke::new(
                1.0,
                egui::Color32::from_rgba_unmultiplied(255, 220, 140, 32),
            ),
        ));
    } else {
        painter.circle_filled(center, radius, fill);
        painter.circle_stroke(center, radius, egui::Stroke::new(4.0 * zoom, status));
        painter.circle_stroke(
            center,
            radius - 8.0 * zoom,
            egui::Stroke::new(
                1.0,
                egui::Color32::from_rgba_unmultiplied(255, 220, 140, 22),
            ),
        );
    }
    painter.circle_filled(center, (radius - 12.0 * zoom).max(8.0), inner);

    if node.status == NodeStatus::InProgress {
        let arc_radius = radius;
        let end = node.progress as f32 / 100.0 * std::f32::consts::TAU;
        let arc = (0..=32)
            .map(|index| {
                let angle = -std::f32::consts::FRAC_PI_2 + end * index as f32 / 32.0;
                center + egui::vec2(angle.cos() * arc_radius, angle.sin() * arc_radius)
            })
            .collect::<Vec<_>>();
        painter.line(arc, egui::Stroke::new(5.0 * zoom, STATUS_IN_PROGRESS));
    }

    match node.status {
        NodeStatus::Completed => {
            let a = center + egui::vec2(-9.0, 1.0) * zoom;
            let b = center + egui::vec2(-3.0, 8.0) * zoom;
            let c = center + egui::vec2(12.0, -10.0) * zoom;
            painter.line_segment([a, b], egui::Stroke::new(2.5 * zoom, status));
            painter.line_segment([b, c], egui::Stroke::new(2.5 * zoom, status));
        }
        NodeStatus::Locked => {
            let body = egui::Rect::from_center_size(
                center + egui::vec2(0.0, 5.0) * zoom,
                egui::vec2(16.0, 12.0) * zoom,
            );
            painter.rect_stroke(
                body,
                2.0,
                egui::Stroke::new(1.5 * zoom, status),
                egui::StrokeKind::Middle,
            );
            painter.line_segment(
                [
                    center + egui::vec2(-6.0, 0.0) * zoom,
                    center + egui::vec2(-6.0, -6.0) * zoom,
                ],
                egui::Stroke::new(1.5 * zoom, status),
            );
            painter.line_segment(
                [
                    center + egui::vec2(6.0, 0.0) * zoom,
                    center + egui::vec2(6.0, -6.0) * zoom,
                ],
                egui::Stroke::new(1.5 * zoom, status),
            );
            painter.line_segment(
                [
                    center + egui::vec2(-6.0, -6.0) * zoom,
                    center + egui::vec2(6.0, -6.0) * zoom,
                ],
                egui::Stroke::new(1.5 * zoom, status),
            );
        }
        _ => {
            painter.text(
                center,
                egui::Align2::CENTER_CENTER,
                initials(&node.title),
                egui::FontId::proportional(if is_keystone { 22.0 } else { 18.0 } * zoom),
                ACCENT,
            );
        }
    }

    let pip_count = node.difficulty.clamp(1, 5);
    let total_width = (pip_count as f32 - 1.0) * 8.0 * zoom;
    for index in 0..pip_count {
        painter.circle_filled(
            center
                + egui::vec2(
                    index as f32 * 8.0 * zoom - total_width * 0.5,
                    -radius - 3.0 * zoom,
                ),
            2.6 * zoom,
            status,
        );
    }

    let title = truncate_label(&node.title, 28);
    let plate_center = center + egui::vec2(0.0, radius + 19.0 * zoom);
    let plate = egui::Rect::from_center_size(
        plate_center,
        egui::vec2((title.chars().count() as f32 * 7.1 + 22.0).min(200.0), 24.0) * zoom,
    );
    painter.rect_filled(
        plate,
        2.0,
        if selected {
            egui::Color32::from_rgba_unmultiplied(217, 178, 76, 32)
        } else {
            egui::Color32::from_rgba_unmultiplied(10, 14, 22, 190)
        },
    );
    painter.rect_stroke(
        plate,
        2.0,
        egui::Stroke::new(1.0, if selected { status } else { BORDER2 }),
        egui::StrokeKind::Middle,
    );
    painter.text(
        plate.center(),
        egui::Align2::CENTER_CENTER,
        title,
        egui::FontId::proportional(12.0 * zoom),
        if node.status == NodeStatus::Locked {
            FG3
        } else {
            FG1
        },
    );

    let done = node.sub_tasks.iter().filter(|task| task.done).count();
    let meta = format!(
        "{}{} / {}/{} / {}h",
        node.status.label(),
        if node.status == NodeStatus::InProgress {
            format!(" {}%", node.progress)
        } else {
            String::new()
        },
        done,
        node.sub_tasks.len(),
        node.estimated_hours
            .map(|hours| format!("{hours:.0}"))
            .unwrap_or_else(|| "-".to_string())
    );
    painter.text(
        plate.center_bottom() + egui::vec2(0.0, 12.0 * zoom),
        egui::Align2::CENTER_CENTER,
        meta,
        egui::FontId::monospace(10.0 * zoom),
        FG3,
    );
}

fn initials(title: &str) -> String {
    let value = title
        .split_whitespace()
        .take(2)
        .filter_map(|word| word.chars().next())
        .collect::<String>()
        .to_ascii_uppercase();
    if value.is_empty() {
        "?".to_string()
    } else {
        value
    }
}

fn truncate_label(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let mut out = value
        .chars()
        .take(max_chars.saturating_sub(1))
        .collect::<String>();
    out.push_str("...");
    out
}

fn default_difficulty() -> u8 {
    1
}

fn default_edge_type() -> EdgeType {
    EdgeType::Prerequisite
}

fn default_theme() -> String {
    "rpg-dark".to_string()
}

fn compare_nodes(a: &SkillNode, b: &SkillNode) -> std::cmp::Ordering {
    a.position_y
        .partial_cmp(&b.position_y)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then_with(|| {
            a.position_x
                .partial_cmp(&b.position_x)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .then_with(|| a.title.cmp(&b.title))
}

fn edge_id(source: &str, target: &str, edge_type: &EdgeType) -> String {
    format!(
        "edge-{}",
        stable_hash(&format!("{source}->{target}:{edge_type:?}"))
    )
}

fn status_color(status: &NodeStatus) -> egui::Color32 {
    match status {
        NodeStatus::Locked => STATUS_LOCKED,
        NodeStatus::Available => STATUS_READY,
        NodeStatus::InProgress => STATUS_IN_PROGRESS,
        NodeStatus::Completed => STATUS_DONE,
    }
}

fn stable_hash(input: &str) -> String {
    let mut hash: u32 = 5381;
    for byte in input.bytes() {
        hash = hash.wrapping_mul(33) ^ u32::from(byte);
    }
    format!("{hash:x}")
}

fn slugify(value: &str, fallback: &str) -> String {
    let slug = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if slug.is_empty() {
        fallback
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
            .collect()
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_node(id: &str, title: &str, parent_id: Option<&str>, y: f32) -> SkillNode {
        SkillNode {
            tree_id: "tree-learning".to_string(),
            id: id.to_string(),
            parent_id: parent_id.map(ToString::to_string),
            title: title.to_string(),
            description: Some(format!("{title} description")),
            difficulty: 2,
            estimated_hours: Some(3.5),
            progress: 50,
            status: NodeStatus::InProgress,
            position_x: 100.0,
            position_y: y,
            style: None,
            sub_tasks: vec![
                SubTask {
                    title: "Read docs".to_string(),
                    done: true,
                },
                SubTask {
                    title: "Build project".to_string(),
                    done: false,
                },
            ],
            resources: vec![Resource {
                title: "Reference".to_string(),
                url: "https://example.com".to_string(),
            }],
            notes: Some("Use this inside Obsidian too.".to_string()),
            sub_tree_id: None,
        }
    }

    fn sample_tree() -> SkillTree {
        SkillTree {
            id: "tree-learning".to_string(),
            user_id: "local-user".to_string(),
            title: "Learning Path".to_string(),
            description: Some("A local-first roadmap.".to_string()),
            slug: "learning-path".to_string(),
            is_public: false,
            share_mode: ShareMode::Private,
            theme: default_theme(),
            canvas_state: None,
            nodes: vec![
                sample_node("node-foundations", "Foundations", None, 0.0),
                sample_node(
                    "node-accessibility",
                    "Accessibility",
                    Some("node-foundations"),
                    1.0,
                ),
            ],
            edges: vec![SkillEdge {
                tree_id: "tree-learning".to_string(),
                id: edge_id(
                    "node-foundations",
                    "node-accessibility",
                    &EdgeType::Prerequisite,
                ),
                source_node_id: "node-foundations".to_string(),
                target_node_id: "node-accessibility".to_string(),
                r#type: EdgeType::Prerequisite,
                style: None,
            }],
            folder: PathBuf::new(),
        }
    }

    #[test]
    fn rendered_node_note_round_trips_core_fields_and_dependencies() {
        let tree = sample_tree();
        let node = tree
            .nodes
            .iter()
            .find(|node| node.id == "node-accessibility")
            .unwrap();

        let markdown = render_node_note(&tree, node);
        let parsed = parse_node_note(&markdown, None, &tree.id).unwrap();

        assert_eq!(parsed.node.id, "node-accessibility");
        assert_eq!(parsed.node.parent_id.as_deref(), Some("node-foundations"));
        assert_eq!(parsed.node.title, "Accessibility");
        assert_eq!(parsed.node.status, NodeStatus::InProgress);
        assert_eq!(parsed.node.progress, 50);
        assert_eq!(parsed.node.sub_tasks.len(), 2);
        assert!(parsed.node.sub_tasks[0].done);
        assert_eq!(parsed.node.resources[0].url, "https://example.com");
        assert_eq!(
            parsed.dependencies.get(&EdgeTypeKey::Prerequisite).unwrap(),
            &vec!["node-foundations".to_string()]
        );
        assert!(parsed.has_dependency_metadata);
    }

    #[test]
    fn write_tree_creates_markdown_manifest_and_nested_node_paths() {
        let temp_dir = tempfile::tempdir().unwrap();
        let storage_root = temp_dir.path().join("SkillTree");
        let mut tree = sample_tree();

        write_tree(&storage_root, &mut tree).unwrap();

        let tree_folder = storage_root.join("learning-path");
        assert!(tree_folder.join(TREE_NOTE_FILE).exists());
        assert!(tree_folder.join(MANIFEST_FILE).exists());
        assert!(tree_folder.join("01-foundations.md").exists());
        assert!(tree_folder
            .join("01-foundations")
            .join("01-accessibility.md")
            .exists());

        let manifest = fs::read_to_string(tree_folder.join(MANIFEST_FILE)).unwrap();
        let manifest: Manifest = serde_json::from_str(&manifest).unwrap();
        let obsidian = manifest.obsidian.unwrap();
        assert_eq!(obsidian.app_tree_id, "tree-learning");
        assert_eq!(obsidian.root_folder, "SkillTree");
        assert_eq!(
            obsidian.node_paths.get("node-accessibility").unwrap(),
            "SkillTree/learning-path/01-foundations/01-accessibility.md"
        );
    }

    #[test]
    fn progress_from_subtasks_drives_status_updates() {
        let mut node = sample_node("node-progress", "Progress", None, 0.0);

        sync_progress_from_subtasks(&mut node);

        assert_eq!(node.progress, 50);
        assert_eq!(node.status, NodeStatus::InProgress);

        for task in &mut node.sub_tasks {
            task.done = true;
        }
        sync_progress_from_subtasks(&mut node);

        assert_eq!(node.progress, 100);
        assert_eq!(node.status, NodeStatus::Completed);
    }
}
