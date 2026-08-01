use agentswarm_lib::transcript::parse_codex_line;
fn main(){
  let f = std::env::args().nth(1).unwrap();
  let text = std::fs::read_to_string(&f).unwrap();
  let (mut n, mut k) = (0usize, std::collections::BTreeMap::<String,usize>::new());
  let mut sample = Vec::new();
  for l in text.lines() { for c in parse_codex_line(1, l) {
      n += 1; *k.entry(c.kind.clone()).or_default() += 1;
      if sample.len() < 4 && !c.body.is_empty() {
        sample.push(format!("  {:<7} {:<14} {}", c.kind, c.title, c.body.chars().take(64).collect::<String>()));
      } } }
  println!("  lines {} -> {} cards", text.lines().count(), n);
  for (kk,v) in &k { println!("     {kk:<8} {v}"); }
  for s in sample { println!("{s}"); }
}
