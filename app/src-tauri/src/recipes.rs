//! M4 — recipes.
//!
//! A recipe is a named swarm: the panes you always open together, with the
//! folders they belong in and the policy each one runs under. The exit test for
//! this milestone is "the morning swarm is one command", and this is the file
//! that has to make that true.
//!
//! Recipes live in `.agentswarm/recipes.json` next to the project, falling back
//! to `~/.agentswarm/recipes.json`. Project first, deliberately: the swarm you
//! want is a property of the work, not of the machine — and a project file can
//! be committed, so a repo can ship the swarm that works on it.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Serialize, Deserialize)]
pub struct RecipePane {
    pub profile: String,
    #[serde(default)]
    pub cwd: Option<String>,
    /// A human name for this pane — "reviewer", "tests", "docs".
    #[serde(default)]
    pub label: Option<String>,
    /// Extra flags for the process. This is where a per-pane policy profile
    /// lives: `["--permission-mode", "plan"]`. AgentSwarm passes these through
    /// verbatim and never adds any of its own — see `pty::resolve`.
    #[serde(default)]
    pub args: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub panes: Vec<RecipePane>,
}

#[derive(Default, Serialize, Deserialize)]
pub struct Book {
    #[serde(default)]
    pub recipes: Vec<Recipe>,
}

fn project_file(cwd: &str) -> PathBuf {
    PathBuf::from(cwd).join(".agentswarm").join("recipes.json")
}

fn home_file() -> Option<PathBuf> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()?;
    Some(PathBuf::from(home).join(".agentswarm").join("recipes.json"))
}

/// What `load` found, including what it could not read.
///
/// `problems` exists because the first version silently returned nothing when a
/// recipe file was malformed. The recipes simply never appeared, with no error
/// anywhere — the same shape of failure as the blank panes in M1, in a product
/// whose whole argument is that silence is the bug. A file you wrote and the app
/// rejected is exactly when you need to be told why.
#[derive(Default, Serialize)]
pub struct Loaded {
    pub recipes: Vec<Recipe>,
    pub problems: Vec<String>,
}

/// Every recipe visible from `cwd`. Project recipes come first and shadow a
/// home recipe of the same name, so a repo can override a personal default
/// without either file having to know about the other.
pub fn load(cwd: &str) -> Loaded {
    let mut out = Loaded::default();
    let mut seen: Vec<String> = Vec::new();

    for path in [Some(project_file(cwd)), home_file()].into_iter().flatten() {
        let Ok(text) = std::fs::read_to_string(&path) else { continue }; // absent is fine
        let name = path.display().to_string();

        // A malformed file must not take the terminal down with it — the app is
        // a terminal first, and every other feature is a guest in it. But it
        // must not disappear quietly either.
        let book = match serde_json::from_str::<Book>(&text) {
            Ok(b) => b,
            Err(e) => {
                out.problems.push(format!("{name} — line {}: {}", e.line(), e));
                continue;
            }
        };
        for r in book.recipes {
            if r.name.trim().is_empty() {
                out.problems.push(format!("{name} — a recipe with no name was skipped"));
            } else if r.panes.is_empty() {
                out.problems.push(format!("{name} — recipe \"{}\" has no panes", r.name));
            } else if seen.contains(&r.name) {
                continue; // shadowed by a project recipe; expected, not a problem
            } else {
                seen.push(r.name.clone());
                out.recipes.push(r);
            }
        }
    }
    out
}

/// Write a recipe into the project file, replacing any recipe of the same name.
/// Saving is what makes recipes worth having: you arrange the swarm once, by
/// hand, and keep it — rather than authoring JSON up front for a layout you have
/// not tried yet.
pub fn save(cwd: &str, recipe: Recipe) -> Result<PathBuf, String> {
    if recipe.name.trim().is_empty() {
        return Err("a recipe needs a name".into());
    }
    if recipe.panes.is_empty() {
        return Err("a recipe needs at least one pane".into());
    }
    let path = project_file(cwd);
    let dir = path.parent().ok_or("no parent directory")?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;

    let mut book: Book = std::fs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();

    book.recipes.retain(|r| r.name != recipe.name);
    book.recipes.push(recipe);
    book.recipes.sort_by(|a, b| a.name.cmp(&b.name));

    let text = serde_json::to_string_pretty(&book).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn book(json: &str) -> Vec<Recipe> {
        serde_json::from_str::<Book>(json).map(|b| b.recipes).unwrap_or_default()
    }

    #[test]
    fn reads_a_recipe_with_only_the_required_fields() {
        let r = book(r#"{"recipes":[{"name":"morning","panes":[{"profile":"claude"}]}]}"#);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].name, "morning");
        assert!(r[0].panes[0].args.is_empty());
        assert!(r[0].panes[0].cwd.is_none());
    }

    #[test]
    fn carries_policy_arguments_through_untouched() {
        let r = book(r#"{"recipes":[{"name":"review","panes":[
            {"profile":"claude","cwd":"E:\\x","label":"reviewer","args":["--permission-mode","plan"]}]}]}"#);
        assert_eq!(r[0].panes[0].args, vec!["--permission-mode", "plan"]);
        assert_eq!(r[0].panes[0].label.as_deref(), Some("reviewer"));
    }

    #[test]
    fn a_broken_file_yields_nothing_rather_than_panicking() {
        // the terminal must survive a bad recipe file; it is a guest here
        assert!(book("not json").is_empty());
        assert!(book(r#"{"recipes":[{"name":"x"}]}"#).is_empty()); // panes missing
        assert!(book("{}").is_empty());
    }

    #[test]
    fn round_trips_through_the_project_file() {
        let dir = std::env::temp_dir().join("agentswarm-recipe-test");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let cwd = dir.to_string_lossy().to_string();

        save(&cwd, Recipe {
            name: "morning".into(),
            description: Some("the daily three".into()),
            panes: vec![RecipePane {
                profile: "claude".into(),
                cwd: Some(cwd.clone()),
                label: Some("swarm".into()),
                args: vec!["--permission-mode".into(), "plan".into()],
            }],
        }).unwrap();

        let loaded = load(&cwd);
        assert!(loaded.problems.is_empty(), "{:?}", loaded.problems);
        assert_eq!(loaded.recipes.len(), 1);
        assert_eq!(loaded.recipes[0].panes[0].args.len(), 2);

        // saving the same name replaces rather than duplicates
        save(&cwd, Recipe {
            name: "morning".into(),
            description: None,
            panes: vec![RecipePane { profile: "pwsh".into(), cwd: None, label: None, args: vec![] }],
        }).unwrap();
        let loaded = load(&cwd);
        assert_eq!(loaded.recipes.len(), 1);
        assert_eq!(loaded.recipes[0].panes[0].profile, "pwsh");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_malformed_file_is_reported_rather_than_ignored() {
        // the bug this caught: a recipe file with a bad escape produced zero
        // recipes and zero explanation, so the feature just looked broken
        let dir = std::env::temp_dir().join("agentswarm-recipe-bad");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".agentswarm")).unwrap();
        std::fs::write(dir.join(".agentswarm").join("recipes.json"),
                       r#"{"recipes":[{"name":"x","panes":[{"profile":"claude","cwd":"E:\bad"}"#).unwrap();
        let cwd = dir.to_string_lossy().to_string();

        let loaded = load(&cwd);
        assert!(loaded.recipes.is_empty());
        assert_eq!(loaded.problems.len(), 1, "a broken file must explain itself");
        assert!(loaded.problems[0].contains("recipes.json"));
        assert!(loaded.problems[0].contains("line"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_missing_file_is_not_a_problem() {
        // absent recipes are the normal state, not an error worth reporting
        let dir = std::env::temp_dir().join("agentswarm-recipe-none");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let loaded = load(&dir.to_string_lossy());
        assert!(loaded.problems.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_a_recipe_that_would_be_useless() {
        let cwd = std::env::temp_dir().to_string_lossy().to_string();
        assert!(save(&cwd, Recipe { name: "  ".into(), description: None,
            panes: vec![RecipePane { profile: "cmd".into(), cwd: None, label: None, args: vec![] }] }).is_err());
        assert!(save(&cwd, Recipe { name: "x".into(), description: None, panes: vec![] }).is_err());
    }
}
