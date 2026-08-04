---
name: a-schema-description-is-not-the-schema
description: "I declared RAGTruth's hallucination spans missing by reading a loader's feature list instead of the parquet — verify data claims against bytes, never against documentation"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1aa8a35d-01e9-4a2c-ae81-507b9c694d25
  modified: 2026-08-04T07:58:44.377Z
---

I told Vaishak, in a README and in chat, that **no HuggingFace copy of RAGTruth
carries word-level hallucination spans** — and framed it as a correction of my
own earlier claim, which made it sound extra-verified.

It was false. `wandb/RAGTruth-processed` carries them: 943 of 2,700 test rows
with `{start, end, text, label_type}` character offsets into the response, plus
`evident_conflict` / `baseless_info` flags. One `pq.read_schema()` would have
shown the columns.

I had inspected the `datasets` loader's reported features and a dataset card,
not the file. So the source whose granularity **exactly matches our faithfulness
gate** got demoted to "passage/response pairs only" and was nearly discarded.

**Why:** the failure mode is specific and repeats. Documentation, dataset cards,
feature lists and library metadata describe what someone *intended* to publish.
The bytes are what was published. A confident negative claim ("this data does
not exist") drawn from a description is the most expensive kind, because it
stops anyone looking again.

**How to apply:** before claiming a dataset, API response, export or database
lacks a field — open it and read the actual schema and a populated row. Cheap:
`pq.read_schema(path)`, `head -c 2000`, `.keys()` on one record. And when
issuing a correction, verify the *correction* at least as hard as the original
claim; a correction inherits unearned credibility.

Same instinct as the project's existing rule about printing refused quotes
instead of trusting the count. See [[nimbus-dataset]], [[recall-core-built]].
