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
const SETTINGS_FILE: &str = "settings.json";
const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL: &str = "anthropic/claude-sonnet-4.6";
const MODEL_OPTIONS: &[&str] = &[
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.1",
    "anthropic/claude-haiku-4.5",
    "openai/gpt-5",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-pro",
    "google/gemini-2.0-flash-001",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat",
];
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
const FG4: egui::Color32 = egui::Color32::from_rgb(74, 71, 56);
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

#[derive(Clone, Debug, Serialize, Deserialize)]
struct AppSettings {
    #[serde(default)]
    openrouter_api_key: String,
    #[serde(default = "default_model")]
    openrouter_model: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            openrouter_api_key: String::new(),
            openrouter_model: DEFAULT_MODEL.to_string(),
        }
    }
}

fn default_model() -> String {
    DEFAULT_MODEL.to_string()
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
    #[serde(default)]
    tags: Vec<String>,
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
    show_new_tree_input: bool,
    show_edit_controls: bool,
    inspector_tab: usize, // 0 = Details, 1 = Markdown
    new_tag: String,
    active_tag_filter: Option<String>,
    canvas_offset: egui::Vec2,
    canvas_zoom: f32,
    update_rx: Option<Receiver<String>>,
    settings: AppSettings,
    show_settings: bool,
    settings_model_custom: String,
    show_conjure: bool,
    conjure_prompt: String,
    conjure_running: bool,
    conjure_error: Option<String>,
    conjure_results: Vec<ConjureSuggestion>,
    conjure_rx: Option<Receiver<Result<String, String>>>,
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
            show_new_tree_input: false,
            show_edit_controls: false,
            inspector_tab: 0,
            new_tag: String::new(),
            active_tag_filter: None,
            canvas_offset: egui::vec2(140.0, 80.0),
            canvas_zoom: 0.9,
            update_rx: start_update_check(),
            settings: load_settings(),
            show_settings: false,
            settings_model_custom: String::new(),
            show_conjure: false,
            conjure_prompt: String::new(),
            conjure_running: false,
            conjure_error: None,
            conjure_results: Vec::new(),
            conjure_rx: None,
        };
        app.reload();
        app
    }

    fn poll_conjure(&mut self) {
        let Some(rx) = &self.conjure_rx else {
            return;
        };
        match rx.try_recv() {
            Ok(Ok(raw)) => {
                self.conjure_running = false;
                self.conjure_rx = None;
                match parse_conjure_json(&raw) {
                    Ok(list) if !list.is_empty() => {
                        self.conjure_results = list;
                        self.conjure_error = None;
                        self.status_line = format!("Conjured {} ideas", self.conjure_results.len());
                    }
                    Ok(_) => {
                        self.conjure_error = Some("Model returned no suggestions.".into());
                    }
                    Err(err) => {
                        self.conjure_error = Some(format!(
                            "Could not parse model output as JSON: {err}. Raw start: {}",
                            raw.chars().take(160).collect::<String>()
                        ));
                    }
                }
            }
            Ok(Err(err)) => {
                self.conjure_running = false;
                self.conjure_rx = None;
                self.conjure_error = Some(err);
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                self.conjure_running = false;
                self.conjure_rx = None;
            }
        }
    }

    fn open_conjure(&mut self) {
        self.show_conjure = true;
        self.conjure_error = None;
        if self.conjure_prompt.trim().is_empty() {
            if let Some(node) = self.selected_node_ref() {
                self.conjure_prompt = format!(
                    "Suggest 5 child skills that deepen \"{}\". Cover prerequisites and logical next steps.",
                    node.title
                );
            }
        }
    }

    fn selected_node_ref(&self) -> Option<&SkillNode> {
        let tree = self.selected_tree_ref()?;
        let id = self.selected_node_id.as_deref()?;
        tree.nodes.iter().find(|n| n.id == id)
    }

    fn start_conjure_request(&mut self) {
        if self.conjure_running {
            return;
        }
        let api_key = self.settings.openrouter_api_key.clone();
        let model = self.settings.openrouter_model.clone();
        let Some(node) = self.selected_node_ref().cloned() else {
            self.conjure_error = Some("Select a node first.".into());
            return;
        };
        let user_ask = if self.conjure_prompt.trim().is_empty() {
            format!("Suggest 5 child skills that deepen \"{}\".", node.title)
        } else {
            self.conjure_prompt.clone()
        };
        let system = CONJURE_SYSTEM_PROMPT;
        let user = build_conjure_user_prompt(
            &node.title,
            node.description.as_deref().unwrap_or(""),
            &user_ask,
        );

        let (tx, rx) = mpsc::channel();
        self.conjure_rx = Some(rx);
        self.conjure_running = true;
        self.conjure_error = None;
        self.conjure_results.clear();
        thread::spawn(move || {
            let result = openrouter_complete(&api_key, &model, system, &user)
                .map_err(|e| format!("{e:#}"));
            let _ = tx.send(result);
        });
    }

    fn apply_conjure_suggestions(&mut self) {
        let Some(tree_index) = self.selected_tree else { return };
        let Some(parent_id) = self.selected_node_id.clone() else { return };
        let parent_pos = match self.trees[tree_index].nodes.iter().find(|n| n.id == parent_id) {
            Some(n) => (n.position_x, n.position_y),
            None => (200.0, 200.0),
        };
        let tree_id = self.trees[tree_index].id.clone();
        let mut added = 0usize;
        let results = std::mem::take(&mut self.conjure_results);
        let count = results.len() as f32;
        for (i, s) in results.into_iter().enumerate() {
            let id = format!("ai-{}", stable_hash(&format!("{}-{}", parent_id, s.title)));
            if self.trees[tree_index].nodes.iter().any(|n| n.id == id) {
                continue;
            }
            let x = parent_pos.0 + (i as f32 - (count - 1.0) * 0.5) * 220.0;
            let y = parent_pos.1 + 180.0;
            let node = SkillNode {
                tree_id: tree_id.clone(),
                id: id.clone(),
                parent_id: Some(parent_id.clone()),
                title: s.title,
                description: Some(s.description),
                difficulty: s.difficulty.clamp(1, 5),
                estimated_hours: s.estimated_hours,
                progress: 0,
                status: NodeStatus::Available,
                position_x: x,
                position_y: y,
                style: None,
                sub_tasks: Vec::new(),
                resources: Vec::new(),
                notes: None,
                sub_tree_id: None,
                tags: vec!["conjured".into()],
            };
            self.trees[tree_index].nodes.push(node);
            self.trees[tree_index].edges.push(SkillEdge {
                tree_id: tree_id.clone(),
                id: edge_id(&parent_id, &id, &EdgeType::Prerequisite),
                source_node_id: parent_id.clone(),
                target_node_id: id,
                r#type: EdgeType::Prerequisite,
                style: None,
            });
            added += 1;
        }
        if added > 0 {
            self.status_line = format!("Applied {} conjured nodes", added);
            self.show_conjure = false;
            self.conjure_prompt.clear();
        }
    }

    fn render_settings_overlay(&mut self, ctx: &egui::Context) {
        let mut open = true;
        let mut save_and_close = false;
        egui::Window::new("Settings")
            .open(&mut open)
            .collapsible(false)
            .resizable(false)
            .default_width(460.0)
            .anchor(egui::Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                ui.add_space(6.0);
                ui.label(
                    egui::RichText::new("OPENROUTER")
                        .monospace()
                        .color(FG3)
                        .size(11.0),
                );
                ui.add_space(6.0);

                ui.label(egui::RichText::new("API key").color(FG2).size(12.0));
                ui.add_space(2.0);
                ui.add_sized(
                    [ui.available_width(), 26.0],
                    egui::TextEdit::singleline(&mut self.settings.openrouter_api_key)
                        .password(true)
                        .hint_text("sk-or-v1-..."),
                );
                ui.add_space(4.0);
                ui.label(
                    egui::RichText::new("Get a key at https://openrouter.ai/keys")
                        .color(FG3)
                        .size(11.0),
                );

                ui.add_space(14.0);
                ui.label(egui::RichText::new("Model").color(FG2).size(12.0));
                ui.add_space(2.0);
                egui::ComboBox::from_id_salt("or-model-combo")
                    .width(ui.available_width())
                    .selected_text(self.settings.openrouter_model.clone())
                    .show_ui(ui, |ui| {
                        for model in MODEL_OPTIONS {
                            ui.selectable_value(
                                &mut self.settings.openrouter_model,
                                (*model).to_string(),
                                *model,
                            );
                        }
                    });
                ui.add_space(6.0);
                ui.label(
                    egui::RichText::new("Custom model slug (optional)")
                        .color(FG3)
                        .size(11.0),
                );
                ui.horizontal(|ui| {
                    let r = ui.add_sized(
                        [ui.available_width() - 76.0, 24.0],
                        egui::TextEdit::singleline(&mut self.settings_model_custom)
                            .hint_text("vendor/model-id"),
                    );
                    if ui.add(toolbar_button("Use")).clicked()
                        || (r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)))
                    {
                        let v = self.settings_model_custom.trim().to_string();
                        if !v.is_empty() {
                            self.settings.openrouter_model = v;
                            self.settings_model_custom.clear();
                        }
                    }
                });

                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.add(primary_toolbar_button("Save")).clicked() {
                            save_and_close = true;
                        }
                        if ui.add(toolbar_button("Cancel")).clicked() {
                            save_and_close = false;
                            // Fall through; we'll re-load on cancel below.
                            self.settings = load_settings();
                            self.show_settings = false;
                        }
                    });
                });
                ui.add_space(4.0);
            });
        if save_and_close {
            if let Err(err) = save_settings(&self.settings) {
                self.status_line = format!("Settings save failed: {err:#}");
            } else {
                self.status_line = "Settings saved".into();
                self.show_settings = false;
            }
        }
        if !open {
            self.show_settings = false;
        }
    }

    fn render_conjure_overlay(&mut self, ctx: &egui::Context) {
        let mut open = true;
        let node_title = self
            .selected_node_ref()
            .map(|n| n.title.clone())
            .unwrap_or_else(|| "—".into());
        let mut generate = false;
        let mut apply_now = false;
        egui::Window::new("Conjure")
            .open(&mut open)
            .collapsible(false)
            .resizable(true)
            .default_width(520.0)
            .default_height(440.0)
            .anchor(egui::Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new("PARENT SKILL")
                            .monospace()
                            .color(FG3)
                            .size(11.0),
                    );
                    ui.label(
                        egui::RichText::new(&node_title)
                            .color(FG1)
                            .size(13.0)
                            .strong(),
                    );
                });

                ui.add_space(10.0);
                ui.label(
                    egui::RichText::new("PROMPT")
                        .monospace()
                        .color(FG3)
                        .size(11.0),
                );
                ui.add_sized(
                    [ui.available_width(), 80.0],
                    egui::TextEdit::multiline(&mut self.conjure_prompt)
                        .desired_rows(3)
                        .hint_text("Describe what to conjure…"),
                );

                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!("Model: {}", self.settings.openrouter_model))
                            .color(FG3)
                            .size(11.0)
                            .monospace(),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if self.conjure_running {
                            ui.add_enabled(false, toolbar_button("Generating…"));
                        } else if ui.add(primary_toolbar_button("Generate")).clicked() {
                            generate = true;
                        }
                    });
                });

                if let Some(err) = &self.conjure_error {
                    ui.add_space(6.0);
                    let (rect, _) = ui.allocate_exact_size(
                        egui::vec2(ui.available_width(), 0.0),
                        egui::Sense::hover(),
                    );
                    let _ = rect;
                    ui.colored_label(
                        egui::Color32::from_rgb(200, 107, 92),
                        format!("⚠  {err}"),
                    );
                }

                ui.add_space(10.0);
                ui.separator();
                ui.add_space(6.0);

                if self.conjure_results.is_empty() {
                    ui.label(
                        egui::RichText::new(
                            "Suggestions will appear here after you hit Generate.",
                        )
                        .color(FG3)
                        .size(12.0),
                    );
                } else {
                    ui.label(
                        egui::RichText::new(format!(
                            "{} suggestion(s) — edit will be wired as prerequisites of the parent.",
                            self.conjure_results.len()
                        ))
                        .color(FG2)
                        .size(12.0),
                    );
                    ui.add_space(6.0);
                    egui::ScrollArea::vertical()
                        .max_height(200.0)
                        .show(ui, |ui| {
                            for s in &self.conjure_results {
                                let frame = egui::Frame::new()
                                    .fill(BG1)
                                    .stroke(egui::Stroke::new(1.0, BORDER1))
                                    .corner_radius(2.0)
                                    .inner_margin(egui::Margin::symmetric(10, 8));
                                frame.show(ui, |ui| {
                                    ui.horizontal(|ui| {
                                        ui.label(
                                            egui::RichText::new(&s.title)
                                                .color(FG1)
                                                .size(13.0)
                                                .strong(),
                                        );
                                        ui.with_layout(
                                            egui::Layout::right_to_left(egui::Align::Center),
                                            |ui| {
                                                let hours = s
                                                    .estimated_hours
                                                    .map(|h| format!("{h:.0}h"))
                                                    .unwrap_or_else(|| "—".into());
                                                ui.label(
                                                    egui::RichText::new(format!(
                                                        "Diff {}/5 · {}",
                                                        s.difficulty.clamp(1, 5),
                                                        hours
                                                    ))
                                                    .monospace()
                                                    .color(FG3)
                                                    .size(11.0),
                                                );
                                            },
                                        );
                                    });
                                    if !s.description.is_empty() {
                                        ui.add_space(2.0);
                                        ui.label(
                                            egui::RichText::new(&s.description)
                                                .color(FG2)
                                                .size(12.0),
                                        );
                                    }
                                });
                                ui.add_space(6.0);
                            }
                        });
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if ui.add(primary_toolbar_button("Add all to canvas")).clicked() {
                                apply_now = true;
                            }
                            if ui.add(toolbar_button("Discard")).clicked() {
                                self.conjure_results.clear();
                            }
                        });
                    });
                }
                ui.add_space(4.0);
            });
        if generate {
            self.start_conjure_request();
        }
        if apply_now {
            self.apply_conjure_suggestions();
        }
        if !open {
            self.show_conjure = false;
        }
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
                    // Empty storage → show a rich demo tree in memory so the
                    // canvas is not barren on first launch. Not persisted.
                    self.trees = demo_trees();
                    self.selected_tree = Some(0);
                    // Prefer an in-progress node so the inspector shows a
                    // rich state (progress bar + partial subtasks).
                    self.selected_node_id = self.trees[0]
                        .nodes
                        .iter()
                        .find(|n| n.status == NodeStatus::InProgress)
                        .or_else(|| self.trees[0].nodes.first())
                        .map(|n| n.id.clone());
                } else {
                    let fallback = self.selected_tree.unwrap_or(0).min(self.trees.len() - 1);
                    let next_index = self
                        .trees
                        .iter()
                        .position(|t| !t.nodes.is_empty())
                        .unwrap_or(fallback);
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
            tags: Vec::new(),
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
        self.poll_conjure();

        if ctx.input_mut(|input| input.consume_key(egui::Modifiers::COMMAND, egui::Key::S)) {
            self.save_selected_tree();
        }
        if ctx.input_mut(|input| input.consume_key(egui::Modifiers::COMMAND, egui::Key::R)) {
            self.reload();
        }
        if ctx.input_mut(|input| input.consume_key(egui::Modifiers::COMMAND, egui::Key::J)) {
            if self.selected_node_id.is_some() {
                self.open_conjure();
            }
        }
        if (self.show_settings || self.show_conjure)
            && ctx.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        {
            if self.show_settings {
                // Esc on settings = cancel (drop in-flight edits)
                self.settings = load_settings();
                self.show_settings = false;
            }
            if self.show_conjure {
                self.show_conjure = false;
            }
        }

        if let Some(tree) = self.selected_tree_ref() {
            ctx.send_viewport_cmd(egui::ViewportCommand::Title(format!(
                "{} \u{2014} SkillTree",
                tree.title
            )));
        }

        egui::TopBottomPanel::top("os_title_bar")
            .exact_height(30.0)
            .frame(egui::Frame::new().fill(BG0))
            .show_separator_line(false)
            .show(ctx, |ui| self.render_os_title_bar(ui));

        egui::TopBottomPanel::top("actions_bar")
            .exact_height(38.0)
            .frame(egui::Frame::new().fill(BG0))
            .show_separator_line(false)
            .show(ctx, |ui| self.render_top_bar(ui));

        egui::TopBottomPanel::bottom("status_bar")
            .exact_height(24.0)
            .frame(egui::Frame::new().fill(BG0))
            .show_separator_line(false)
            .show(ctx, |ui| self.render_status_bar(ui));

        egui::SidePanel::left("tree_sidebar")
            .resizable(false)
            .exact_width(240.0)
            .frame(egui::Frame::new().fill(BG2))
            .show_separator_line(false)
            .show(ctx, |ui| self.render_tree_rail(ui));

        egui::SidePanel::right("inspector")
            .resizable(false)
            .exact_width(380.0)
            .frame(egui::Frame::new().fill(BG2))
            .show_separator_line(false)
            .show(ctx, |ui| self.render_inspector(ui));

        egui::CentralPanel::default().show(ctx, |ui| {
            self.render_canvas(ui);
        });

        if self.show_settings {
            self.render_settings_overlay(ctx);
        }
        if self.show_conjure {
            self.render_conjure_overlay(ctx);
        } else if self.conjure_rx.is_some() {
            // Dialog was closed mid-flight — cut the worker loose so the
            // next Generate starts cleanly.
            self.conjure_rx = None;
            self.conjure_running = false;
        }
    }
}

impl SkillTreeApp {
    fn render_os_title_bar(&mut self, ui: &mut egui::Ui) {
        let rect = ui.max_rect();
        let painter = ui.painter();
        painter.rect_filled(rect, 0.0, BG0);
        painter.line_segment(
            [rect.left_bottom(), rect.right_bottom()],
            egui::Stroke::new(1.0, BORDER1),
        );

        // macOS traffic-light dots
        let dots = [
            egui::Color32::from_rgb(237, 106, 94),
            egui::Color32::from_rgb(224, 195, 79),
            egui::Color32::from_rgb(108, 193, 93),
        ];
        let dot_radius = 5.5;
        for (i, color) in dots.iter().enumerate() {
            let cx = rect.left() + 14.0 + i as f32 * 18.0;
            let cy = rect.center().y;
            painter.circle_filled(egui::pos2(cx, cy), dot_radius, *color);
            painter.circle_stroke(
                egui::pos2(cx, cy),
                dot_radius,
                egui::Stroke::new(0.5, egui::Color32::from_rgba_unmultiplied(0, 0, 0, 65)),
            );
        }

        // Centered title
        let tree_title = self
            .selected_tree_ref()
            .map(|t| t.title.clone())
            .unwrap_or_else(|| "Untitled".to_string());
        painter.text(
            egui::pos2(rect.center().x, rect.center().y),
            egui::Align2::CENTER_CENTER,
            format!("{} \u{2014} SkillTree", tree_title),
            egui::FontId::monospace(11.0),
            FG3,
        );
    }

    fn render_top_bar(&mut self, ui: &mut egui::Ui) {
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, 0.0, BG0);
        ui.painter().line_segment(
            [rect.left_bottom(), rect.right_bottom()],
            egui::Stroke::new(1.0, BORDER1),
        );

        ui.add_space(2.0);
        ui.horizontal_centered(|ui| {
            ui.add_space(8.0);

            // App branding — Cinzel serif matches handoff display font
            ui.label(
                egui::RichText::new("\u{25B2}")
                    .color(ACCENT)
                    .size(13.0),
            );
            ui.add_space(2.0);
            ui.label(
                egui::RichText::new("SkillTree")
                    .family(egui::FontFamily::Name("display".into()))
                    .strong()
                    .color(FG1)
                    .size(14.0),
            );

            // LOCAL badge (custom painted pill)
            ui.add_space(4.0);
            let (badge_rect, _) =
                ui.allocate_exact_size(egui::vec2(42.0, 16.0), egui::Sense::hover());
            ui.painter().rect_filled(badge_rect, 2.0, BG2);
            ui.painter().rect_stroke(
                badge_rect,
                2.0,
                egui::Stroke::new(1.0, BORDER1),
                egui::StrokeKind::Middle,
            );
            ui.painter().text(
                badge_rect.center(),
                egui::Align2::CENTER_CENTER,
                "LOCAL",
                egui::FontId::monospace(10.0),
                FG3,
            );

            ui.add_space(4.0);
            vertical_divider(ui);
            ui.add_space(4.0);

            // Folder path (chip-styled button)
            let path_text = if let Some(tree) = self.selected_tree_ref() {
                short_path(&tree.folder, 32)
            } else {
                short_path(&self.storage_root, 32)
            };
            let folder_label = format!("\u{1F4C1}  {}", path_text);
            if ui.add(chip_button(&folder_label)).clicked() {
                self.choose_storage_root();
            }

            // Tag filter pills
            let unique_tags: Vec<String> = self
                .selected_tree_ref()
                .map(|tree| {
                    let mut set: Vec<String> = Vec::new();
                    for n in &tree.nodes {
                        for t in &n.tags {
                            if !set.contains(t) {
                                set.push(t.clone());
                            }
                        }
                    }
                    set.sort();
                    set
                })
                .unwrap_or_default();

            if !unique_tags.is_empty() {
                ui.add_space(4.0);
                ui.label(
                    egui::RichText::new("#")
                        .monospace()
                        .color(FG3)
                        .size(11.0),
                );
                let mut clicked: Option<String> = None;
                for tag in unique_tags.iter().take(4) {
                    let is_active = self.active_tag_filter.as_ref() == Some(tag);
                    if tag_pill(ui, tag, is_active).clicked() {
                        clicked = Some(tag.clone());
                    }
                }
                if let Some(tag) = clicked {
                    self.active_tag_filter = if self.active_tag_filter.as_ref() == Some(&tag) {
                        None
                    } else {
                        Some(tag)
                    };
                }
            }

            // Right-aligned actions — lean set matching handoff hero
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(6.0);

                // Inspector toggle (rightmost)
                let _ = ui.add(icon_chip("\u{25A3}", true))
                    .on_hover_text("Toggle inspector");

                // Settings (gear)
                if ui
                    .add(icon_chip("\u{2699}", false))
                    .on_hover_text("OpenRouter settings")
                    .clicked()
                {
                    self.settings_model_custom.clear();
                    self.show_settings = true;
                }

                // Link vault / vault name
                if ui.add(chip_button("\u{2726}  Link vault")).clicked() {
                    self.use_obsidian_vault();
                }

                // Conjure primary (opens AI dialog for selected node)
                let enabled = self.selected_node_id.is_some();
                let (fg, bg, stroke) = if enabled {
                    (
                        ACCENT_2,
                        egui::Color32::from_rgba_unmultiplied(217, 178, 76, 24),
                        ACCENT,
                    )
                } else {
                    (FG3, BG2, BORDER2)
                };
                let conjure = egui::Button::new(
                    egui::RichText::new("\u{2728}  Conjure  \u{2318}J")
                        .color(fg)
                        .size(11.0),
                )
                .fill(bg)
                .stroke(egui::Stroke::new(1.0, stroke))
                .corner_radius(2.0)
                .min_size(egui::vec2(0.0, 24.0));
                let resp = ui.add_enabled(enabled, conjure);
                if !enabled {
                    resp.clone().on_hover_text("Select a node first");
                }
                if resp.clicked() && enabled {
                    self.open_conjure();
                }

                // History icon (reload)
                if ui.add(icon_chip("\u{21BB}", false))
                    .on_hover_text("Reload (Ctrl+R)").clicked()
                {
                    self.reload();
                }

                // Quick find chip
                let (qf_rect, qf_resp) =
                    ui.allocate_exact_size(egui::vec2(150.0, 24.0), egui::Sense::click());
                ui.painter().rect_filled(qf_rect, 2.0, BG2);
                ui.painter().rect_stroke(
                    qf_rect,
                    2.0,
                    egui::Stroke::new(1.0, BORDER2),
                    egui::StrokeKind::Middle,
                );
                ui.painter().text(
                    egui::pos2(qf_rect.left() + 10.0, qf_rect.center().y),
                    egui::Align2::LEFT_CENTER,
                    "\u{1F50D}  Quick find",
                    egui::FontId::proportional(11.0),
                    FG3,
                );
                ui.painter().text(
                    egui::pos2(qf_rect.right() - 10.0, qf_rect.center().y),
                    egui::Align2::RIGHT_CENTER,
                    "\u{2318}K",
                    egui::FontId::monospace(10.0),
                    FG3,
                );
                if qf_resp.hovered() {
                    ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                }
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

        let total_nodes: usize = self.trees.iter().map(|t| t.nodes.len()).sum();
        let total_done = self
            .trees
            .iter()
            .flat_map(|t| t.nodes.iter())
            .filter(|n| n.status == NodeStatus::Completed)
            .count();
        let is_vault = self.storage_root.starts_with(DEFAULT_OBSIDIAN_VAULT);
        let mode = if is_vault { "Obsidian vault" } else { "Local" };
        let path_text = self
            .selected_tree_ref()
            .map(|t| short_path(&t.folder, 40))
            .unwrap_or_else(|| short_path(&self.storage_root, 40));
        let selected_id = self.selected_node_id.clone();
        let trees_len = self.trees.len();
        let status_line = self.status_line.clone();

        ui.horizontal_centered(|ui| {
            ui.add_space(10.0);
            // Status dot + mode
            let (dot_rect, _) = ui.allocate_exact_size(egui::vec2(10.0, 12.0), egui::Sense::hover());
            ui.painter().circle_filled(
                dot_rect.center(),
                3.0,
                if is_vault { ACCENT } else { STATUS_DONE },
            );
            ui.label(egui::RichText::new(mode).monospace().color(FG2).size(11.0));

            ui.add_space(6.0);
            vertical_divider(ui);
            ui.add_space(6.0);

            ui.label(
                egui::RichText::new(path_text)
                    .monospace()
                    .color(FG3)
                    .size(11.0),
            );

            ui.add_space(6.0);
            vertical_divider(ui);
            ui.add_space(6.0);

            ui.label(
                egui::RichText::new(format!("{} trees", trees_len))
                    .monospace()
                    .color(FG3)
                    .size(11.0),
            );
            ui.label(egui::RichText::new("\u{00B7}").color(FG4).size(11.0));
            ui.label(
                egui::RichText::new(format!("{} nodes", total_nodes))
                    .monospace()
                    .color(FG2)
                    .size(11.0),
            );
            ui.label(egui::RichText::new("\u{00B7}").color(FG4).size(11.0));
            ui.label(
                egui::RichText::new(format!("{} done", total_done))
                    .monospace()
                    .color(STATUS_DONE)
                    .size(11.0),
            );

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(10.0);
                ui.label(
                    egui::RichText::new(&status_line)
                        .monospace()
                        .color(FG3)
                        .size(11.0),
                );
                if let Some(node_id) = selected_id {
                    ui.add_space(6.0);
                    vertical_divider(ui);
                    ui.add_space(6.0);
                    ui.label(
                        egui::RichText::new(node_id)
                            .monospace()
                            .color(FG3)
                            .size(11.0),
                    );
                }
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

        // Header row (36px) with bottom border separator
        let header_rect = egui::Rect::from_min_size(rect.left_top(), egui::vec2(rect.width(), 36.0));
        ui.painter().line_segment(
            [header_rect.left_bottom(), header_rect.right_bottom()],
            egui::Stroke::new(1.0, BORDER1),
        );
        ui.horizontal(|ui| {
            ui.set_min_height(36.0);
            ui.add_space(12.0);
            ui.label(
                egui::RichText::new("TREES")
                    .monospace()
                    .color(FG3)
                    .size(11.0),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(8.0);
                // New tree (+)
                if ui
                    .add(icon_chip("+", false))
                    .on_hover_text("New tree")
                    .clicked()
                {
                    self.show_new_tree_input = !self.show_new_tree_input;
                }
            });
        });

        // Conditional new-tree input
        if self.show_new_tree_input {
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                ui.add_space(10.0);
                let r = ui.add_sized(
                    [(ui.available_width() - 62.0).max(60.0), 24.0],
                    egui::TextEdit::singleline(&mut self.new_tree_title)
                        .hint_text("Tree title..."),
                );
                if ui.add(toolbar_button("Create")).clicked()
                    || (r.lost_focus()
                        && ui.input(|i| i.key_pressed(egui::Key::Enter))
                        && !self.new_tree_title.trim().is_empty())
                {
                    self.create_tree();
                    self.show_new_tree_input = false;
                }
                ui.add_space(10.0);
            });
        }

        // Search input with bottom border
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            ui.add_space(10.0);
            let filter_rect_width = (ui.available_width() - 20.0).max(80.0);
            let (filter_rect, _) =
                ui.allocate_exact_size(egui::vec2(filter_rect_width, 26.0), egui::Sense::hover());
            ui.painter().rect_filled(filter_rect, 2.0, BG1);
            ui.painter().rect_stroke(
                filter_rect,
                2.0,
                egui::Stroke::new(1.0, BORDER2),
                egui::StrokeKind::Middle,
            );
            ui.painter().text(
                egui::pos2(filter_rect.left() + 10.0, filter_rect.center().y),
                egui::Align2::LEFT_CENTER,
                "\u{1F50D}",
                egui::FontId::proportional(11.0),
                FG3,
            );
            let inner_rect = egui::Rect::from_min_max(
                filter_rect.min + egui::vec2(26.0, 2.0),
                filter_rect.max - egui::vec2(6.0, 2.0),
            );
            let child_id = ui.id().with("tree_filter_edit");
            let mut child =
                ui.new_child(egui::UiBuilder::new().max_rect(inner_rect).id_salt(child_id));
            child.add(
                egui::TextEdit::singleline(&mut self.tree_filter)
                    .frame(false)
                    .hint_text("Filter..."),
            );
        });
        ui.add_space(8.0);
        let (sep_rect, _) = ui.allocate_exact_size(egui::vec2(ui.available_width(), 1.0), egui::Sense::hover());
        ui.painter().rect_filled(sep_rect, 0.0, BORDER1);
        ui.add_space(4.0);

        // Tree & node list
        let mut next_tree = None;
        let mut next_node = None;
        let filter = self.tree_filter.trim().to_lowercase();

        egui::ScrollArea::vertical().show(ui, |ui| {
            for index in 0..self.trees.len() {
                let tree = &self.trees[index];
                let is_active = Some(index) == self.selected_tree;
                let done = tree
                    .nodes
                    .iter()
                    .filter(|n| n.status == NodeStatus::Completed)
                    .count();

                // Tree header row
                let icon = tree_glyph(index);
                let response = tree_header_row(
                    ui,
                    &truncate_label(&tree.title, 20),
                    &format!("{}/{}", done, tree.nodes.len()),
                    is_active,
                    icon,
                );
                if response.clicked() {
                    next_tree = Some(index);
                }

                // Node rows (only for active tree)
                if is_active {
                    let rows = node_rows(tree)
                        .into_iter()
                        .filter_map(|(nid, depth)| {
                            tree.nodes
                                .iter()
                                .find(|n| n.id == nid)
                                .map(|n| (n.clone(), depth))
                        })
                        .collect::<Vec<_>>();

                    for (node, depth) in rows {
                        if !filter.is_empty()
                            && !node.title.to_lowercase().contains(&filter)
                        {
                            continue;
                        }
                        if let Some(ref tag) = self.active_tag_filter {
                            if !node.tags.iter().any(|t| t == tag) {
                                continue;
                            }
                        }
                        let is_selected =
                            self.selected_node_id.as_deref() == Some(node.id.as_str());
                        let color = status_color(&node.status);
                        let max_chars = 24usize.saturating_sub(depth * 2).max(12);
                        let progress_label =
                            if node.status == NodeStatus::InProgress && node.progress > 0 {
                                Some(format!("{}%", node.progress))
                            } else {
                                None
                            };
                        let response = node_rail_row(
                            ui,
                            &truncate_label(&node.title, max_chars),
                            is_selected,
                            color,
                            progress_label.as_deref(),
                            (depth * 14) as f32,
                        );
                        if response.clicked() {
                            next_node = Some(node.id);
                        }
                    }
                }
            }
        });

        // Footer row (folder icon + active tree path)
        let footer_rect = egui::Rect::from_min_max(
            egui::pos2(rect.left(), rect.bottom() - 30.0),
            egui::pos2(rect.right(), rect.bottom()),
        );
        ui.painter().line_segment(
            [footer_rect.left_top(), footer_rect.right_top()],
            egui::Stroke::new(1.0, BORDER1),
        );
        let footer_path = self
            .selected_tree_ref()
            .map(|t| short_path(&t.folder, 34))
            .unwrap_or_else(|| short_path(&self.storage_root, 34));
        ui.painter().text(
            egui::pos2(footer_rect.left() + 12.0, footer_rect.center().y),
            egui::Align2::LEFT_CENTER,
            "\u{1F4C1}",
            egui::FontId::proportional(11.0),
            FG3,
        );
        ui.painter().text(
            egui::pos2(footer_rect.left() + 30.0, footer_rect.center().y),
            egui::Align2::LEFT_CENTER,
            footer_path,
            egui::FontId::monospace(10.0),
            FG3,
        );

        if let Some(index) = next_tree {
            self.selected_tree = Some(index);
            let selected_exists = self
                .selected_node_id
                .as_deref()
                .is_some_and(|id| self.trees[index].nodes.iter().any(|n| n.id == id));
            if !selected_exists {
                self.selected_node_id =
                    self.trees[index].nodes.first().map(|n| n.id.clone());
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

        draw_canvas_vignette(&painter, rect);

        painter.text(
            rect.left_bottom() + egui::vec2(12.0, -16.0),
            egui::Align2::LEFT_CENTER,
            "DRAG \u{00B7} MIDDLE-DRAG PAN \u{00B7} CTRL+SCROLL ZOOM",
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
                ui.label(egui::RichText::new("No tree selected").color(FG2).size(16.0));
                ui.add_space(6.0);
                ui.label(
                    egui::RichText::new("Create or select a tree to start")
                        .color(FG3)
                        .size(12.0),
                );
            });
            return;
        };

        let Some(node_id) = self.selected_node_id.clone() else {
            ui.vertical_centered(|ui| {
                ui.add_space(120.0);
                ui.label(
                    egui::RichText::new("No node selected")
                        .color(FG2)
                        .size(16.0),
                );
                ui.add_space(6.0);
                ui.label(
                    egui::RichText::new("Click a node on the canvas")
                        .color(FG3)
                        .size(12.0),
                );
            });
            return;
        };

        let Some(node_index) = self.trees[tree_index]
            .nodes
            .iter()
            .position(|n| n.id == node_id)
        else {
            ui.label("Node not found.");
            return;
        };

        // Snapshot values for display (before mutable borrows)
        let node = &self.trees[tree_index].nodes[node_index];
        let node_status = node.status.clone();
        let node_title = node.title.clone();
        let node_progress = node.progress;
        let node_difficulty = node.difficulty;
        let node_est_hours = node.estimated_hours;
        let subtask_done = node.sub_tasks.iter().filter(|t| t.done).count();
        let subtask_total = node.sub_tasks.len();
        let status_color_val = status_color(&node_status);

        // ── Status Badge (pill) — clickable to cycle ──────────────
        ui.add_space(8.0);
        let mut badge_clicked = false;
        {
            let badge_text = match &node_status {
                NodeStatus::InProgress => format!("IN PROGRESS  {}%", node_progress),
                NodeStatus::Completed => "FORGED".to_string(),
                NodeStatus::Available => "READY".to_string(),
                NodeStatus::Locked => "SEALED".to_string(),
            };
            let badge_bg = egui::Color32::from_rgba_unmultiplied(
                status_color_val.r(),
                status_color_val.g(),
                status_color_val.b(),
                65,
            );
            ui.horizontal(|ui| {
                ui.add_space(20.0);
                let inner = egui::Frame::new()
                    .fill(badge_bg)
                    .corner_radius(2.0)
                    .stroke(egui::Stroke::new(
                        1.0,
                        egui::Color32::from_rgba_unmultiplied(
                            status_color_val.r(),
                            status_color_val.g(),
                            status_color_val.b(),
                            110,
                        ),
                    ))
                    .inner_margin(egui::Margin::symmetric(8, 3))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            let (dot_rect, _) = ui.allocate_exact_size(
                                egui::vec2(10.0, 10.0),
                                egui::Sense::hover(),
                            );
                            ui.painter().circle_filled(
                                dot_rect.center(),
                                4.0,
                                status_color_val,
                            );
                            ui.label(
                                egui::RichText::new(&badge_text)
                                    .monospace()
                                    .color(status_color_val)
                                    .size(11.0),
                            );
                        });
                    });
                let hit = ui.interact(
                    inner.response.rect,
                    ui.id().with("status-badge-cycle"),
                    egui::Sense::click(),
                );
                if hit.clicked() {
                    badge_clicked = true;
                }
                if hit.hovered() {
                    ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                }

                // Close and menu buttons (right-aligned)
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.add_space(12.0);
                    if ui
                        .add(
                            egui::Button::new(
                                egui::RichText::new("\u{00D7}").color(FG2).size(16.0),
                            )
                            .fill(egui::Color32::TRANSPARENT)
                            .stroke(egui::Stroke::NONE)
                            .min_size(egui::vec2(22.0, 22.0)),
                        )
                        .on_hover_text("Deselect")
                        .clicked()
                    {
                        self.selected_node_id = None;
                    }
                    if ui
                        .add(
                            egui::Button::new(
                                egui::RichText::new("\u{2022}\u{2022}\u{2022}")
                                    .color(FG3)
                                    .size(12.0),
                            )
                            .fill(egui::Color32::TRANSPARENT)
                            .stroke(egui::Stroke::NONE)
                            .min_size(egui::vec2(22.0, 22.0)),
                        )
                        .on_hover_text("More actions")
                        .clicked()
                    {
                        self.show_edit_controls = !self.show_edit_controls;
                    }
                });
            });
        }
        if badge_clicked {
            let node = &mut self.trees[tree_index].nodes[node_index];
            node.status = match node.status {
                NodeStatus::Locked => NodeStatus::Available,
                NodeStatus::Available => NodeStatus::InProgress,
                NodeStatus::InProgress => NodeStatus::Completed,
                NodeStatus::Completed => NodeStatus::Locked,
            };
        }

        // ── Title ─────────────────────────────────────────────────
        ui.add_space(12.0);
        ui.horizontal(|ui| {
            ui.add_space(20.0);
            // Inter SemiBold reads mixed-case; Cinzel is reserved for display
            // flourishes (brand, orb initials) where caps are intended.
            ui.label(
                egui::RichText::new(&node_title)
                    .size(20.0)
                    .strong()
                    .color(FG1),
            );
        });

        // ── Metadata line ─────────────────────────────────────────
        ui.add_space(2.0);
        let node_tags = self.trees[tree_index].nodes[node_index].tags.clone();
        ui.horizontal_wrapped(|ui| {
            ui.add_space(12.0);
            let hours_text = node_est_hours
                .map(|h| format!("{:.0}h", h))
                .unwrap_or_else(|| "-".to_string());
            ui.label(
                egui::RichText::new(format!("Difficulty {}/5", node_difficulty))
                    .color(FG2)
                    .size(12.0),
            );
            ui.label(egui::RichText::new("\u{00B7}").color(FG3).size(12.0));
            ui.label(
                egui::RichText::new(hours_text)
                    .monospace()
                    .color(FG2)
                    .size(12.0),
            );
            // Tag pills
            for tag in &node_tags {
                ui.add_space(2.0);
                let _ = tag_pill(ui, &format!("#{}", tag), false);
            }
        });

        // ── Tab bar (Details / Markdown) ──────────────────────────
        ui.add_space(14.0);
        {
            let (bar_rect, _) = ui.allocate_exact_size(
                egui::vec2(ui.available_width(), 30.0),
                egui::Sense::hover(),
            );
            ui.painter().rect_filled(bar_rect, 0.0, BG1);
            ui.painter().line_segment(
                [bar_rect.left_bottom(), bar_rect.right_bottom()],
                egui::Stroke::new(1.0, BORDER1),
            );
            let labels = ["DETAILS", "MARKDOWN"];
            let half = bar_rect.width() / labels.len() as f32;
            for (i, label) in labels.iter().enumerate() {
                let seg = egui::Rect::from_min_size(
                    bar_rect.min + egui::vec2(i as f32 * half, 0.0),
                    egui::vec2(half, bar_rect.height()),
                );
                let response = ui.interact(
                    seg,
                    ui.id().with(("inspector-tab", i)),
                    egui::Sense::click(),
                );
                let is_sel = self.inspector_tab == i;
                if is_sel {
                    ui.painter().line_segment(
                        [
                            seg.left_bottom() + egui::vec2(0.0, -1.0),
                            seg.right_bottom() + egui::vec2(0.0, -1.0),
                        ],
                        egui::Stroke::new(2.0, ACCENT),
                    );
                }
                ui.painter().text(
                    seg.center(),
                    egui::Align2::CENTER_CENTER,
                    *label,
                    egui::FontId::monospace(11.0),
                    if is_sel { FG1 } else { FG3 },
                );
                if response.clicked() {
                    self.inspector_tab = i;
                }
            }
        }

        if self.inspector_tab == 1 {
            // Markdown preview
            ui.add_space(12.0);
            let folder_text = self
                .selected_tree_ref()
                .map(|t| short_path(&t.folder, 28))
                .unwrap_or_else(|| "~/skilltree".to_string());
            ui.horizontal(|ui| {
                ui.add_space(20.0);
                ui.label(
                    egui::RichText::new(format!("{}/nodes/{}.md", folder_text, node_id))
                        .monospace()
                        .color(FG3)
                        .size(10.0),
                );
            });
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                ui.add_space(16.0);
                let node = &self.trees[tree_index].nodes[node_index];
                let body = render_node_note(&self.trees[tree_index], node);
                let (body_rect, _) = ui.allocate_exact_size(
                    egui::vec2(ui.available_width() - 16.0, 260.0),
                    egui::Sense::hover(),
                );
                ui.painter().rect_filled(body_rect, 2.0, BG1);
                ui.painter().rect_stroke(
                    body_rect,
                    2.0,
                    egui::Stroke::new(1.0, BORDER1),
                    egui::StrokeKind::Middle,
                );
                let inner = body_rect.shrink2(egui::vec2(12.0, 10.0));
                let child_id = ui.id().with("md-preview");
                let mut child = ui
                    .new_child(egui::UiBuilder::new().max_rect(inner).id_salt(child_id));
                child.add(
                    egui::Label::new(
                        egui::RichText::new(body)
                            .monospace()
                            .color(FG1)
                            .size(11.0),
                    )
                    .wrap(),
                );
            });
            return;
        }

        // ── DESCRIPTION ───────────────────────────────────────────
        ui.add_space(14.0);
        section_label(ui, "DESCRIPTION", None);
        ui.add_space(4.0);
        {
            let node = &mut self.trees[tree_index].nodes[node_index];
            let desc = node.description.get_or_insert_with(String::new);
            ui.horizontal(|ui| {
                ui.add_space(12.0);
                ui.add_sized(
                    [(ui.available_width() - 16.0).max(80.0), 56.0],
                    egui::TextEdit::multiline(desc)
                        .desired_rows(3)
                        .frame(false)
                        .text_color(FG2),
                );
            });
        }

        // ── PROGRESS ──────────────────────────────────────────────
        ui.add_space(14.0);
        section_label(ui, "PROGRESS", Some(&format!("{}%", node_progress)));
        ui.add_space(4.0);
        // Custom progress bar
        ui.horizontal(|ui| {
            ui.add_space(12.0);
            let bar_w = (ui.available_width() - 16.0).max(40.0);
            let (bar_rect, _) =
                ui.allocate_exact_size(egui::vec2(bar_w, 8.0), egui::Sense::hover());
            ui.painter().rect_filled(bar_rect, 4.0, BG0);
            if node_progress > 0 {
                let fill_rect = egui::Rect::from_min_size(
                    bar_rect.min,
                    egui::vec2(bar_w * node_progress as f32 / 100.0, 8.0),
                );
                ui.painter().rect_filled(fill_rect, 4.0, status_color_val);
            }
        });
        ui.add_space(4.0);
        ui.horizontal(|ui| {
            ui.add_space(12.0);
            ui.label(
                egui::RichText::new(format!(
                    "{} of {} subtasks complete",
                    subtask_done, subtask_total
                ))
                .color(FG3)
                .size(12.0),
            );
        });

        // ── SUBTASKS ──────────────────────────────────────────────
        ui.add_space(14.0);
        section_label(
            ui,
            "SUBTASKS",
            Some(&format!("{}/{}", subtask_done, subtask_total)),
        );
        ui.add_space(4.0);
        {
            let node = &mut self.trees[tree_index].nodes[node_index];
            let mut remove_idx: Option<usize> = None;
            let mut toggled: Vec<usize> = Vec::new();
            for (idx, task) in node.sub_tasks.iter().enumerate() {
                let task_done = task.done;
                let task_title = task.title.clone();
                ui.horizontal(|ui| {
                    ui.add_space(20.0);
                    let (check_rect, check_resp) =
                        ui.allocate_exact_size(egui::vec2(14.0, 14.0), egui::Sense::click());
                    let fill = if task_done { STATUS_DONE } else { egui::Color32::TRANSPARENT };
                    let border = if task_done { STATUS_DONE } else { BORDER2 };
                    ui.painter().rect_filled(check_rect, 2.0, fill);
                    ui.painter().rect_stroke(
                        check_rect,
                        2.0,
                        egui::Stroke::new(1.0, border),
                        egui::StrokeKind::Middle,
                    );
                    if task_done {
                        let c = check_rect.center();
                        let a = c + egui::vec2(-3.5, 0.0);
                        let b = c + egui::vec2(-1.0, 2.5);
                        let d = c + egui::vec2(3.5, -3.0);
                        ui.painter().line_segment([a, b], egui::Stroke::new(1.6, BG0));
                        ui.painter().line_segment([b, d], egui::Stroke::new(1.6, BG0));
                    }
                    ui.add_space(4.0);
                    let text = if task_done {
                        egui::RichText::new(&task_title)
                            .strikethrough()
                            .color(FG3)
                            .size(13.0)
                    } else {
                        egui::RichText::new(&task_title).color(FG1).size(13.0)
                    };
                    let r = ui.add(egui::Label::new(text).sense(egui::Sense::click()));
                    if check_resp.clicked() || r.clicked() {
                        toggled.push(idx);
                    }
                    if r.secondary_clicked() {
                        remove_idx = Some(idx);
                    }
                });
            }
            for idx in toggled {
                if let Some(task) = node.sub_tasks.get_mut(idx) {
                    task.done = !task.done;
                }
            }
            if let Some(idx) = remove_idx {
                node.sub_tasks.remove(idx);
            }
            sync_progress_from_subtasks(node);
        }
        // Add subtask
        ui.add_space(2.0);
        ui.horizontal(|ui| {
            ui.add_space(12.0);
            let r = ui.add_sized(
                [(ui.available_width() - 60.0).max(60.0), 22.0],
                egui::TextEdit::singleline(&mut self.new_subtask_title)
                    .hint_text("Add subtask..."),
            );
            if ui.add(toolbar_button("Add")).clicked()
                || (r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)))
            {
                let title = self.new_subtask_title.trim().to_string();
                if !title.is_empty() {
                    self.trees[tree_index].nodes[node_index]
                        .sub_tasks
                        .push(SubTask {
                            title,
                            done: false,
                        });
                    self.new_subtask_title.clear();
                }
            }
        });

        // ── RESOURCES ─────────────────────────────────────────────
        ui.add_space(14.0);
        section_label(ui, "RESOURCES", None);
        ui.add_space(4.0);
        {
            let node = &self.trees[tree_index].nodes[node_index];
            for resource in &node.resources {
                ui.horizontal(|ui| {
                    ui.add_space(12.0);
                    if ui
                        .add(
                            egui::Label::new(
                                egui::RichText::new(&resource.title)
                                    .color(ACCENT_2)
                                    .size(12.0)
                                    .underline(),
                            )
                            .sense(egui::Sense::click()),
                        )
                        .clicked()
                    {
                        let _ = opener::open(&resource.url);
                    }
                    ui.label(
                        egui::RichText::new(&resource.url)
                            .color(FG3)
                            .size(10.0)
                            .monospace(),
                    );
                });
            }
        }
        ui.add_space(2.0);
        ui.horizontal(|ui| {
            ui.add_space(12.0);
            let half = ((ui.available_width() - 56.0) * 0.5).max(40.0);
            ui.add_sized(
                [half, 22.0],
                egui::TextEdit::singleline(&mut self.new_resource_title).hint_text("Title"),
            );
            ui.add_sized(
                [half, 22.0],
                egui::TextEdit::singleline(&mut self.new_resource_url).hint_text("URL"),
            );
            if ui.add(toolbar_button("Add")).clicked() {
                let t = self.new_resource_title.trim().to_string();
                let u = self.new_resource_url.trim().to_string();
                if !t.is_empty() && !u.is_empty() {
                    self.trees[tree_index].nodes[node_index]
                        .resources
                        .push(Resource { title: t, url: u });
                    self.new_resource_title.clear();
                    self.new_resource_url.clear();
                }
            }
        });

        // ── TAGS ──────────────────────────────────────────────────
        ui.add_space(14.0);
        section_label(ui, "TAGS", None);
        ui.add_space(4.0);
        {
            let node = &mut self.trees[tree_index].nodes[node_index];
            let mut remove_idx: Option<usize> = None;
            ui.horizontal_wrapped(|ui| {
                ui.add_space(12.0);
                for (idx, tag) in node.tags.iter().enumerate() {
                    if tag_pill(ui, &format!("#{}", tag), false).secondary_clicked() {
                        remove_idx = Some(idx);
                    }
                }
            });
            if let Some(idx) = remove_idx {
                node.tags.remove(idx);
            }
        }
        ui.add_space(2.0);
        ui.horizontal(|ui| {
            ui.add_space(12.0);
            let r = ui.add_sized(
                [(ui.available_width() - 60.0).max(60.0), 22.0],
                egui::TextEdit::singleline(&mut self.new_tag).hint_text("Add tag..."),
            );
            if ui.add(toolbar_button("Add")).clicked()
                || (r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)))
            {
                let tag = self
                    .new_tag
                    .trim()
                    .trim_start_matches('#')
                    .to_string();
                if !tag.is_empty() {
                    let tags = &mut self.trees[tree_index].nodes[node_index].tags;
                    if !tags.contains(&tag) {
                        tags.push(tag);
                    }
                    self.new_tag.clear();
                }
            }
        });

        // ── NOTES ─────────────────────────────────────────────────
        ui.add_space(14.0);
        section_label(ui, "NOTES", None);
        ui.add_space(4.0);
        {
            let node = &mut self.trees[tree_index].nodes[node_index];
            let notes = node.notes.get_or_insert_with(String::new);
            ui.horizontal(|ui| {
                ui.add_space(12.0);
                ui.add_sized(
                    [(ui.available_width() - 16.0).max(80.0), 72.0],
                    egui::TextEdit::multiline(notes)
                        .desired_rows(4)
                        .frame(false)
                        .text_color(FG2),
                );
            });
        }

        // ── Advanced edit controls (toggle via ··· button) ────────
        if self.show_edit_controls {
            ui.add_space(12.0);
            ui.horizontal(|ui| {
                ui.add_space(12.0);
                let (line_rect, _) = ui.allocate_exact_size(
                    egui::vec2(ui.available_width() - 16.0, 1.0),
                    egui::Sense::hover(),
                );
                ui.painter().rect_filled(line_rect, 0.0, BORDER1);
            });
            ui.add_space(8.0);
            {
                let node = &mut self.trees[tree_index].nodes[node_index];
                ui.horizontal(|ui| {
                    ui.add_space(12.0);
                    ui.label(egui::RichText::new("Status").color(FG3).size(11.0));
                    egui::ComboBox::from_id_salt("status_combo")
                        .width(90.0)
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
                    ui.label(egui::RichText::new("Diff").color(FG3).size(11.0));
                    ui.add(
                        egui::Slider::new(&mut node.difficulty, 1..=5).show_value(false),
                    );
                });
                ui.horizontal(|ui| {
                    ui.add_space(12.0);
                    ui.label(egui::RichText::new("Title").color(FG3).size(11.0));
                    ui.add_sized(
                        [(ui.available_width() - 8.0).max(60.0), 22.0],
                        egui::TextEdit::singleline(&mut node.title),
                    );
                });
                ui.horizontal(|ui| {
                    ui.add_space(12.0);
                    ui.label(egui::RichText::new("Hours").color(FG3).size(11.0));
                    let mut hours = node.estimated_hours.unwrap_or(0.0);
                    if ui
                        .add(
                            egui::DragValue::new(&mut hours)
                                .range(0.0..=999.0)
                                .speed(0.5),
                        )
                        .changed()
                    {
                        node.estimated_hours = if hours > 0.0 { Some(hours) } else { None };
                    }
                });
            }

            // Add child node
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.add_space(12.0);
                let r = ui.add_sized(
                    [(ui.available_width() - 80.0).max(60.0), 22.0],
                    egui::TextEdit::singleline(&mut self.new_node_title)
                        .hint_text("New child node..."),
                );
                if ui.add(toolbar_button("Add")).clicked()
                    || (r.lost_focus()
                        && ui.input(|i| i.key_pressed(egui::Key::Enter))
                        && !self.new_node_title.trim().is_empty())
                {
                    let parent = self.selected_node_id.clone();
                    self.create_node(parent);
                }
            });
        }

        // ── Action buttons ────────────────────────────────────────
        ui.add_space(10.0);
        let mut open_note = false;
        let mut save_tree = false;
        ui.horizontal(|ui| {
            ui.add_space(12.0);
            if ui.add(toolbar_button("Open note")).clicked() {
                open_note = true;
            }
            if ui.add(primary_toolbar_button("Save")).clicked() {
                save_tree = true;
            }
        });
        if open_note {
            self.open_selected_node_note();
        }
        if save_tree {
            self.save_selected_tree();
        }

        // ── Dependencies ──────────────────────────────────────────
        ui.add_space(14.0);
        section_label(ui, "DEPENDENCIES", None);
        ui.add_space(4.0);
        let deps = self.trees[tree_index]
            .edges
            .iter()
            .filter(|e| e.target_node_id == node_id)
            .map(|e| {
                let src = self.trees[tree_index]
                    .nodes
                    .iter()
                    .find(|n| n.id == e.source_node_id)
                    .map(|n| n.title.as_str())
                    .unwrap_or(e.source_node_id.as_str());
                format!("{:?}: {}", e.r#type, src)
            })
            .collect::<Vec<_>>();
        if deps.is_empty() {
            ui.horizontal(|ui| {
                ui.add_space(12.0);
                ui.label(egui::RichText::new("None").color(FG3).size(12.0));
            });
        } else {
            for dep in deps {
                ui.horizontal(|ui| {
                    ui.add_space(12.0);
                    ui.label(egui::RichText::new(dep).color(FG2).size(12.0));
                });
            }
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
            ("tags", serde_json::to_string(&node.tags).unwrap()),
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
        tags: frontmatter
            .get("tags")
            .and_then(jsonish_to_string_array)
            .or_else(|| existing.map(|node| node.tags.clone()))
            .unwrap_or_default(),
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

fn demo_trees() -> Vec<SkillTree> {
    let tree_id = "demo-dsa";
    let folder = PathBuf::from(default_storage_root()).join("dsa");
    let mk_node = |id: &str,
                   title: &str,
                   status: NodeStatus,
                   difficulty: u8,
                   hours: f32,
                   progress: u8,
                   x: f32,
                   y: f32,
                   desc: &str,
                   subs: &[(&str, bool)],
                   tags: &[&str]|
     -> SkillNode {
        SkillNode {
            tree_id: tree_id.to_string(),
            id: id.to_string(),
            parent_id: None,
            title: title.to_string(),
            description: Some(desc.to_string()),
            difficulty,
            estimated_hours: Some(hours),
            progress,
            status,
            position_x: x,
            position_y: y,
            style: None,
            sub_tasks: subs
                .iter()
                .map(|(t, d)| SubTask {
                    title: (*t).to_string(),
                    done: *d,
                })
                .collect(),
            resources: Vec::new(),
            notes: None,
            sub_tree_id: None,
            tags: tags.iter().map(|t| (*t).to_string()).collect(),
        }
    };
    let nodes = vec![
        mk_node("n1", "Arrays & linked lists", NodeStatus::Completed, 2, 3.0, 100,
            180.0, 80.0,
            "Contiguous memory, pointer chains, and when each wins.",
            &[("Fundamentals", true), ("Pointer arithmetic", true), ("Runtime costs", true)],
            &["foundations"]),
        mk_node("n2", "Hash tables", NodeStatus::Completed, 2, 4.0, 100,
            460.0, 80.0,
            "Chained vs. open addressing, load factor, resizing.",
            &[("Hashing functions", true), ("Collision handling", true)],
            &["foundations"]),
        mk_node("n3", "Binary search trees", NodeStatus::InProgress, 3, 6.0, 60,
            320.0, 230.0,
            "Insert, delete, in-order traversal. Degeneracy and balancing motivation.",
            &[
                ("Read intro chapter", true),
                ("Implement in-order traversal", true),
                ("Balance vs unbalanced notes", true),
                ("Red-black tree walkthrough", false),
                ("Practice set 1", false),
            ],
            &["trees", "balanced"]),
        mk_node("n4", "Graph traversal", NodeStatus::Available, 3, 5.0, 0,
            120.0, 380.0,
            "DFS, BFS, topological sort; when to reach for each.",
            &[("DFS recursive", false), ("BFS queue", false), ("Topological sort", false)],
            &["graphs"]),
        mk_node("n5", "Dynamic programming", NodeStatus::Available, 4, 8.0, 0,
            320.0, 380.0,
            "Memoization, tabulation, subproblem structure.",
            &[("Knapsack", false), ("LIS / LCS", false), ("State compression", false)],
            &["algorithms"]),
        mk_node("n6", "Sorting fundamentals", NodeStatus::Available, 2, 4.0, 0,
            520.0, 380.0,
            "Comparison sorts, stability, external sorting.",
            &[("Quicksort partitioning", false), ("Mergesort merge step", false), ("Stability proof", false)],
            &["algorithms"]),
        mk_node("n7", "Heaps & priority queues", NodeStatus::Locked, 3, 4.0, 0,
            320.0, 520.0,
            "Binary heap invariants, heapify, k-way merge.",
            &[("Heapify", false), ("Top-k with min-heap", false)],
            &["balanced"]),
        mk_node("n8", "Tries & suffix structures", NodeStatus::Locked, 5, 9.0, 0,
            540.0, 520.0,
            "Tries, suffix arrays and their uses in text processing.",
            &[("Basic trie insert", false), ("Suffix array O(n log n)", false)],
            &["advanced"]),
    ];
    let mut edges: Vec<SkillEdge> = Vec::new();
    let add_edge = |edges: &mut Vec<SkillEdge>, from: &str, to: &str, ty: EdgeType| {
        edges.push(SkillEdge {
            tree_id: tree_id.to_string(),
            id: format!("{from}-{to}"),
            source_node_id: from.to_string(),
            target_node_id: to.to_string(),
            r#type: ty,
            style: None,
        });
    };
    add_edge(&mut edges, "n1", "n3", EdgeType::Prerequisite);
    add_edge(&mut edges, "n2", "n3", EdgeType::Prerequisite);
    add_edge(&mut edges, "n3", "n4", EdgeType::Prerequisite);
    add_edge(&mut edges, "n3", "n5", EdgeType::Prerequisite);
    add_edge(&mut edges, "n3", "n6", EdgeType::Recommended);
    add_edge(&mut edges, "n6", "n7", EdgeType::Prerequisite);
    add_edge(&mut edges, "n3", "n8", EdgeType::Optional);

    vec![SkillTree {
        id: tree_id.to_string(),
        user_id: "local".to_string(),
        title: "Data structures & algorithms".to_string(),
        description: Some("Core CS toolkit — visual walkthrough".to_string()),
        slug: "dsa".to_string(),
        is_public: false,
        share_mode: ShareMode::Private,
        theme: default_theme(),
        canvas_state: None,
        nodes,
        edges,
        folder,
    }]
}

fn settings_path() -> PathBuf {
    if let Some(dirs) = ProjectDirs::from("app", "skilltree", "skilltree-local") {
        let dir = dirs.config_dir().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        return dir.join(SETTINGS_FILE);
    }
    PathBuf::from(SETTINGS_FILE)
}

fn load_settings() -> AppSettings {
    let path = settings_path();
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

fn save_settings(settings: &AppSettings) -> Result<()> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    let json = serde_json::to_string_pretty(settings)?;
    fs::write(&path, json).with_context(|| format!("write {}", path.display()))?;
    Ok(())
}

const CONJURE_SYSTEM_PROMPT: &str = "You are a skill-tree design assistant. Given a parent skill, propose concrete \
     follow-up skills the learner should tackle next. Reply with STRICT JSON only, no \
     markdown fences, shaped exactly as:\n\
     {\"suggestions\":[{\"title\":\"...\",\"description\":\"...\",\"difficulty\":1-5,\"estimated_hours\":number}]}\n\
     Keep titles under 48 characters.";

fn build_conjure_user_prompt(title: &str, description: &str, user_ask: &str) -> String {
    format!(
        "Parent skill: {title}\nParent description: {description}\nUser ask: {user_ask}"
    )
}

fn openrouter_complete(api_key: &str, model: &str, system: &str, user: &str) -> Result<String> {
    if api_key.trim().is_empty() {
        return Err(anyhow::anyhow!(
            "No OpenRouter API key configured. Open Settings to paste one."
        ));
    }
    let payload = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": 0.6,
    });
    let response = ureq::post(OPENROUTER_URL)
        .set("Authorization", &format!("Bearer {}", api_key.trim()))
        .set("Content-Type", "application/json")
        .set(
            "HTTP-Referer",
            &format!("https://github.com/{}/{}", GITHUB_OWNER, GITHUB_REPO),
        )
        .set("X-Title", "SkillTree Local")
        .send_json(&payload);
    let body: serde_json::Value = match response {
        Ok(r) => r.into_json()?,
        Err(ureq::Error::Status(status, r)) => {
            let body = r.into_string().unwrap_or_default();
            return Err(anyhow::anyhow!("OpenRouter HTTP {}: {}", status, body));
        }
        Err(err) => return Err(anyhow::anyhow!("OpenRouter transport error: {}", err)),
    };
    let content = body
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("Response missing choices[0].message.content"))?;
    Ok(content.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConjureSuggestion {
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default = "default_difficulty")]
    difficulty: u8,
    #[serde(default)]
    estimated_hours: Option<f32>,
}

fn parse_conjure_json(raw: &str) -> Result<Vec<ConjureSuggestion>> {
    // The model may wrap JSON in ```json ... ``` fences — strip them.
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    let value: serde_json::Value = serde_json::from_str(cleaned)
        .with_context(|| format!("Parse JSON: {}", cleaned.chars().take(200).collect::<String>()))?;
    let list = value
        .get("suggestions")
        .and_then(|v| v.as_array())
        .ok_or_else(|| anyhow::anyhow!("Response missing `suggestions` array"))?;
    let mut out = Vec::new();
    for item in list {
        if let Ok(s) = serde_json::from_value::<ConjureSuggestion>(item.clone()) {
            out.push(s);
        }
    }
    Ok(out)
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

fn apply_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();

    // Embedded Inter (sans) — matches handoff "var(--font-sans)"
    const INTER: &[u8] = include_bytes!("../assets/Inter.ttf");
    fonts.font_data.insert(
        "inter".to_owned(),
        std::sync::Arc::new(egui::FontData::from_static(INTER)),
    );
    fonts
        .families
        .entry(egui::FontFamily::Proportional)
        .or_default()
        .insert(0, "inter".to_owned());

    // Embedded Cinzel (display) — matches handoff "var(--font-display)"
    const CINZEL: &[u8] = include_bytes!("../assets/Cinzel.ttf");
    fonts.font_data.insert(
        "cinzel".to_owned(),
        std::sync::Arc::new(egui::FontData::from_static(CINZEL)),
    );
    fonts.families.insert(
        egui::FontFamily::Name("display".into()),
        vec!["cinzel".to_owned(), "inter".to_owned()],
    );

    // Mono — prefer JetBrains Mono if installed (handoff default)
    let mono_candidates = [
        "/usr/share/fonts/jetbrains-mono/JetBrainsMono-Regular.ttf",
        "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf",
        "/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf",
        "/Library/Fonts/JetBrainsMono-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    ];
    for path in mono_candidates {
        if let Ok(data) = std::fs::read(path) {
            fonts.font_data.insert(
                "ui_mono".to_owned(),
                std::sync::Arc::new(egui::FontData::from_owned(data)),
            );
            fonts
                .families
                .entry(egui::FontFamily::Monospace)
                .or_default()
                .insert(0, "ui_mono".to_owned());
            break;
        }
    }

    ctx.set_fonts(fonts);
}

fn apply_design_system(ctx: &egui::Context) {
    apply_fonts(ctx);
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
        .corner_radius(2.0)
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
    .corner_radius(2.0)
}

fn chip_button(label: &str) -> egui::Button<'_> {
    egui::Button::new(egui::RichText::new(label).color(FG2).size(11.0))
        .fill(BG2)
        .stroke(egui::Stroke::new(1.0, BORDER2))
        .corner_radius(2.0)
        .min_size(egui::vec2(0.0, 24.0))
}

fn icon_chip(glyph: &str, active: bool) -> egui::Button<'_> {
    let color = if active { FG1 } else { FG3 };
    let fill = if active { BG3 } else { egui::Color32::TRANSPARENT };
    egui::Button::new(egui::RichText::new(glyph).color(color).size(13.0))
        .fill(fill)
        .stroke(egui::Stroke::NONE)
        .corner_radius(2.0)
        .min_size(egui::vec2(24.0, 24.0))
}

fn vertical_divider(ui: &mut egui::Ui) {
    let (rect, _) = ui.allocate_exact_size(egui::vec2(1.0, 16.0), egui::Sense::hover());
    ui.painter().rect_filled(rect, 0.0, BORDER1);
}

fn tree_glyph(index: usize) -> &'static str {
    const GLYPHS: &[&str] = &["\u{25C6}", "\u{25B2}", "\u{2756}", "\u{25C9}", "\u{2726}"];
    GLYPHS[index % GLYPHS.len()]
}

fn tree_header_row(
    ui: &mut egui::Ui,
    title: &str,
    count: &str,
    active: bool,
    icon: &str,
) -> egui::Response {
    let width = ui.available_width().max(1.0);
    let (rect, response) = ui.allocate_exact_size(egui::vec2(width, 30.0), egui::Sense::click());
    let fill = if active {
        BG4
    } else if response.hovered() {
        BG3
    } else {
        BG2
    };
    ui.painter().rect_filled(rect, 0.0, fill);

    // Chevron
    let chevron = if active { "\u{25BE}" } else { "\u{25B8}" };
    ui.painter().text(
        egui::pos2(rect.left() + 14.0, rect.center().y),
        egui::Align2::LEFT_CENTER,
        chevron,
        egui::FontId::proportional(10.0),
        FG3,
    );

    // Tree icon
    ui.painter().text(
        egui::pos2(rect.left() + 32.0, rect.center().y),
        egui::Align2::LEFT_CENTER,
        icon,
        egui::FontId::proportional(12.0),
        if active { ACCENT } else { FG3 },
    );

    // Title
    let text_color = if active { FG1 } else { FG2 };
    ui.painter().text(
        egui::pos2(rect.left() + 50.0, rect.center().y),
        egui::Align2::LEFT_CENTER,
        title,
        egui::FontId::proportional(13.0),
        text_color,
    );

    // Count (right)
    ui.painter().text(
        egui::pos2(rect.right() - 12.0, rect.center().y),
        egui::Align2::RIGHT_CENTER,
        count,
        egui::FontId::monospace(11.0),
        FG3,
    );
    response
}

fn node_rail_row(
    ui: &mut egui::Ui,
    title: &str,
    selected: bool,
    dot_color: egui::Color32,
    progress: Option<&str>,
    indent: f32,
) -> egui::Response {
    let width = ui.available_width().max(1.0);
    let (rect, response) = ui.allocate_exact_size(egui::vec2(width, 25.0), egui::Sense::click());
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

    let text_x = rect.left() + 30.0 + indent;

    // Status dot
    ui.painter()
        .circle_filled(egui::pos2(text_x - 10.0, rect.center().y), 3.5, dot_color);

    // Node title
    let text_color = if selected { FG1 } else { FG2 };
    ui.painter().text(
        egui::pos2(text_x, rect.center().y),
        egui::Align2::LEFT_CENTER,
        title,
        egui::FontId::proportional(13.0),
        text_color,
    );

    // Progress % (right)
    if let Some(pct) = progress {
        ui.painter().text(
            egui::pos2(rect.right() - 12.0, rect.center().y),
            egui::Align2::RIGHT_CENTER,
            pct,
            egui::FontId::monospace(11.0),
            FG3,
        );
    }
    response
}

fn tag_pill(ui: &mut egui::Ui, tag: &str, active: bool) -> egui::Response {
    let label = tag.to_string();
    let galley = ui.painter().layout_no_wrap(
        label.clone(),
        egui::FontId::proportional(11.0),
        if active { ACCENT_2 } else { FG2 },
    );
    let pill_size = egui::vec2(galley.size().x + 14.0, 20.0);
    let (rect, response) = ui.allocate_exact_size(pill_size, egui::Sense::click());
    let bg = if active {
        egui::Color32::from_rgba_unmultiplied(217, 178, 76, 40)
    } else if response.hovered() {
        BG3
    } else {
        BG1
    };
    let border = if active { ACCENT } else { BORDER2 };
    ui.painter().rect_filled(rect, 3.0, bg);
    ui.painter().rect_stroke(
        rect,
        3.0,
        egui::Stroke::new(1.0, border),
        egui::StrokeKind::Middle,
    );
    ui.painter().text(
        rect.center(),
        egui::Align2::CENTER_CENTER,
        &label,
        egui::FontId::proportional(11.0),
        if active { ACCENT_2 } else { FG2 },
    );
    response
}

fn section_label(ui: &mut egui::Ui, label: &str, right_text: Option<&str>) {
    ui.horizontal(|ui| {
        ui.add_space(12.0);
        ui.label(
            egui::RichText::new(label)
                .monospace()
                .color(FG3)
                .size(11.0),
        );
        if let Some(rt) = right_text {
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add_space(12.0);
                ui.label(egui::RichText::new(rt).color(FG2).size(12.0));
            });
        }
    });
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

fn radial_disc_mesh(center: egui::Pos2, radius: f32, inner: egui::Color32, outer: egui::Color32) -> egui::Shape {
    let segments = 96u32;
    let mut mesh = egui::Mesh::default();
    mesh.colored_vertex(center, inner);
    for i in 0..=segments {
        let a = std::f32::consts::TAU * i as f32 / segments as f32;
        mesh.colored_vertex(center + egui::vec2(a.cos(), a.sin()) * radius, outer);
    }
    for i in 0..segments {
        mesh.add_triangle(0, i + 1, i + 2);
    }
    egui::Shape::mesh(mesh)
}

fn radial_ring_mesh(
    center: egui::Pos2,
    r_inner: f32,
    r_outer: f32,
    inner: egui::Color32,
    outer: egui::Color32,
) -> egui::Shape {
    let segments = 96u32;
    let mut mesh = egui::Mesh::default();
    for i in 0..=segments {
        let a = std::f32::consts::TAU * i as f32 / segments as f32;
        let dir = egui::vec2(a.cos(), a.sin());
        mesh.colored_vertex(center + dir * r_inner, inner);
        mesh.colored_vertex(center + dir * r_outer, outer);
    }
    for i in 0..segments {
        let base = i * 2;
        mesh.add_triangle(base, base + 1, base + 2);
        mesh.add_triangle(base + 1, base + 3, base + 2);
    }
    egui::Shape::mesh(mesh)
}

fn draw_canvas_background(
    painter: &egui::Painter,
    rect: egui::Rect,
    offset: egui::Vec2,
    zoom: f32,
) {
    // Floor = deep near-black
    painter.rect_filled(rect, 0.0, egui::Color32::from_rgb(5, 8, 15));

    // Smooth radial gradient via GPU-interpolated mesh
    let center = rect.center() + egui::vec2(0.0, -rect.height() * 0.04);
    let reach = rect.width().max(rect.height()) * 0.70;
    painter.add(radial_disc_mesh(
        center,
        reach,
        egui::Color32::from_rgb(38, 54, 80),
        egui::Color32::from_rgba_unmultiplied(5, 8, 15, 0),
    ));
    // A tighter inner glow for extra luminosity
    painter.add(radial_disc_mesh(
        center,
        reach * 0.45,
        egui::Color32::from_rgba_unmultiplied(54, 74, 108, 170),
        egui::Color32::from_rgba_unmultiplied(30, 46, 70, 0),
    ));

    // Grid dots (gold, very subtle)
    let grid = (72.0 * zoom).max(20.0);
    let mut x = rect.left() + offset.x.rem_euclid(grid);
    while x < rect.right() {
        let mut y = rect.top() + offset.y.rem_euclid(grid);
        while y < rect.bottom() {
            painter.circle_filled(
                egui::pos2(x, y),
                1.0,
                egui::Color32::from_rgba_unmultiplied(180, 150, 90, 22),
            );
            y += grid;
        }
        x += grid;
    }

    // Deterministic starfield
    let star_seeds: &[(f32, f32, u8)] = &[
        (0.13, 0.22, 46), (0.82, 0.18, 36), (0.44, 0.77, 40), (0.70, 0.58, 30),
        (0.24, 0.48, 36), (0.90, 0.84, 36), (0.60, 0.12, 28), (0.08, 0.80, 34),
        (0.36, 0.34, 30), (0.66, 0.72, 26), (0.18, 0.64, 30), (0.94, 0.44, 26),
        (0.52, 0.28, 28), (0.76, 0.40, 24), (0.30, 0.88, 24), (0.04, 0.32, 22),
    ];
    for (fx, fy, alpha) in star_seeds {
        painter.circle_filled(
            egui::pos2(rect.left() + rect.width() * *fx, rect.top() + rect.height() * *fy),
            0.9,
            egui::Color32::from_rgba_unmultiplied(255, 240, 200, *alpha),
        );
    }
}

fn draw_canvas_vignette(painter: &egui::Painter, rect: egui::Rect) {
    // True smooth vignette: ring mesh that fades from transparent at ~50%
    // of the diagonal to dark near the edges.
    let r_inner = rect.size().length() * 0.32;
    let r_outer = rect.size().length() * 0.70;
    painter.add(radial_ring_mesh(
        rect.center(),
        r_inner,
        r_outer,
        egui::Color32::from_rgba_unmultiplied(0, 0, 0, 0),
        egui::Color32::from_rgba_unmultiplied(0, 0, 0, 155),
    ));
}

fn draw_canvas_empty(painter: &egui::Painter, rect: egui::Rect, title: &str) {
    let center = rect.center() + egui::vec2(0.0, -24.0);
    painter.circle_filled(
        center,
        32.0,
        egui::Color32::from_rgba_unmultiplied(35, 45, 64, 160),
    );
    painter.circle_stroke(
        center,
        32.0,
        egui::Stroke::new(1.5, BORDER3),
    );
    painter.circle_stroke(
        center,
        20.0,
        egui::Stroke::new(1.0, egui::Color32::from_rgba_unmultiplied(217, 178, 76, 80)),
    );
    painter.text(
        rect.center() + egui::vec2(0.0, 32.0),
        egui::Align2::CENTER_CENTER,
        title,
        egui::FontId::new(16.0, egui::FontFamily::Name("display".into())),
        FG1,
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
        // Stacked translucent strokes approximate the blur filter used in CSS.
        let halo = [
            (9.0, 14u8),
            (6.0, 26u8),
            (3.5, 50u8),
        ];
        for (w, a) in halo {
            painter.line(
                points.clone(),
                egui::Stroke::new(w, egui::Color32::from_rgba_unmultiplied(217, 178, 76, a)),
            );
        }
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
    let size = if is_keystone { 104.0 } else { 86.0 } * zoom;
    let radius = size * 0.5;

    // ── True CSS drop-shadow via a ring mesh (smooth alpha falloff) ──
    let halo_spec: Option<(f32, u8)> = match (selected, &node.status) {
        (true, _)                             => Some((38.0, 180)),
        (_, NodeStatus::Completed)            => Some((24.0, 150)),
        (_, NodeStatus::InProgress)           => Some((30.0, 160)),
        (_, NodeStatus::Available)            => Some((16.0, 110)),
        (_, NodeStatus::Locked)               => None,
    };
    if let Some((reach, core_alpha)) = halo_spec {
        painter.add(radial_ring_mesh(
            center,
            (radius - 1.0).max(2.0),
            radius + reach * zoom,
            egui::Color32::from_rgba_unmultiplied(status.r(), status.g(), status.b(), core_alpha),
            egui::Color32::from_rgba_unmultiplied(status.r(), status.g(), status.b(), 0),
        ));
    }

    // ── Body fill: true radial gradient via mesh ──
    //   center:  dark-navy highlight (slightly offset upward — "lit from above")
    //   70%:     #0d131e
    //   edge:    #05080f
    let body_inner = if selected {
        egui::Color32::from_rgb(42, 52, 80)
    } else {
        egui::Color32::from_rgb(26, 34, 50)
    };
    let body_outer = egui::Color32::from_rgb(5, 8, 15);
    let body_center = center + egui::vec2(0.0, -radius * 0.15);

    if is_keystone {
        let polygon = |r: f32| -> Vec<egui::Pos2> {
            (0..6)
                .map(|i| {
                    let a = std::f32::consts::TAU / 6.0 * i as f32;
                    center + egui::vec2(a.cos() * r, a.sin() * r)
                })
                .collect()
        };
        // Outer hex floor
        painter.add(egui::Shape::convex_polygon(
            polygon(radius - 2.0 * zoom),
            body_outer,
            egui::Stroke::NONE,
        ));
        // Radial highlight inscribed in the hex
        painter.add(radial_disc_mesh(
            body_center,
            radius * 0.88,
            body_inner,
            body_outer,
        ));
        painter.add(egui::Shape::closed_line(
            polygon(radius - 2.0 * zoom),
            egui::Stroke::new(4.0 * zoom, status),
        ));
        painter.add(egui::Shape::closed_line(
            polygon(radius - 8.0 * zoom),
            egui::Stroke::new(
                1.0,
                egui::Color32::from_rgba_unmultiplied(255, 220, 140, 28),
            ),
        ));
    } else {
        painter.add(radial_disc_mesh(
            body_center,
            radius - 2.0 * zoom,
            body_inner,
            body_outer,
        ));
        painter.circle_stroke(center, radius - 2.0 * zoom, egui::Stroke::new(4.0 * zoom, status));
        painter.circle_stroke(
            center,
            radius - 8.0 * zoom,
            egui::Stroke::new(
                1.0,
                egui::Color32::from_rgba_unmultiplied(255, 220, 140, 24),
            ),
        );
    }

    if node.status == NodeStatus::InProgress {
        let arc_radius = radius - 2.0 * zoom;
        let end = (node.progress as f32 / 100.0).clamp(0.0, 1.0) * std::f32::consts::TAU;
        let arc = (0..=40)
            .map(|index| {
                let angle = -std::f32::consts::FRAC_PI_2 + end * index as f32 / 40.0;
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
                egui::FontId::new(
                    if is_keystone { 22.0 } else { 18.0 } * zoom,
                    egui::FontFamily::Name("display".into()),
                ),
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
    let status_label = match node.status {
        NodeStatus::Locked => "SEALED".to_string(),
        NodeStatus::Available => "READY".to_string(),
        NodeStatus::InProgress => format!("IN PROGRESS \u{00B7} {}%", node.progress),
        NodeStatus::Completed => "FORGED".to_string(),
    };
    let hours = node
        .estimated_hours
        .map(|hours| format!("{hours:.0}h"))
        .unwrap_or_else(|| "-".to_string());
    let meta = format!(
        "{}  \u{00B7}  {}/{}  \u{00B7}  {}",
        status_label,
        done,
        node.sub_tasks.len(),
        hours,
    );
    painter.text(
        plate.center_bottom() + egui::vec2(0.0, 10.0 * zoom),
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
            tags: vec!["foundations".to_string()],
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

    // Live integration — gated behind `SKILLTREE_LIVE=1` so normal
    // `cargo test` never hits the network. Mirrors exactly what the
    // Conjure button builds in `start_conjure_request`.
    #[test]
    fn live_openrouter_conjure_end_to_end() {
        if std::env::var("SKILLTREE_LIVE").ok().as_deref() != Some("1") {
            eprintln!("skip: set SKILLTREE_LIVE=1 to run");
            return;
        }
        let settings = load_settings();
        assert!(
            !settings.openrouter_api_key.trim().is_empty(),
            "settings.json has no openrouter_api_key"
        );
        let user = build_conjure_user_prompt(
            "Binary search trees",
            "Insert, delete, in-order traversal. Balancing motivation.",
            "Suggest 3 child skills that deepen this.",
        );
        let raw = openrouter_complete(
            &settings.openrouter_api_key,
            &settings.openrouter_model,
            CONJURE_SYSTEM_PROMPT,
            &user,
        )
        .expect("openrouter call succeeded");
        let list = parse_conjure_json(&raw).expect("parse JSON suggestions");
        assert!(!list.is_empty(), "model returned zero suggestions");
        println!(
            "\nLIVE Conjure OK — model: {} — {} suggestion(s):",
            settings.openrouter_model,
            list.len()
        );
        for s in &list {
            let hours = s
                .estimated_hours
                .map(|h| format!("{h:.0}h"))
                .unwrap_or_else(|| "?".into());
            println!(
                "  • {} [diff {}/5, {}] — {}",
                s.title,
                s.difficulty.clamp(1, 5),
                hours,
                s.description,
            );
        }
    }
}
