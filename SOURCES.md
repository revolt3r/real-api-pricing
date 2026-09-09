# Sources and third-party notices

The project's original software is licensed under [MIT](LICENSE). This does not relicense third-party material, quotations, or source datasets. Their applicable terms and attribution continue to apply.

## Awesome Coding Plan

- Work: [awesome-coding-plan](https://github.com/mahonzhan/awesome-coding-plan)
- Creator identification requested by the upstream license: mahonzhan@gmail.com
- License notice: Licensed under the Creative Commons Attribution 4.0 International License.
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [upstream LICENCE](https://github.com/mahonzhan/awesome-coding-plan/blob/main/LICENCE)
- Used for: historical ChatGPT Plus / Codex Sol and Claude Pro / Opus 4.8 usage measurements. See `data/research/quotas-web-2026-09.json` and `scripts/build_adopted.py`.
- Changes: selected measurements are mapped to this project's served-model identities, normalized to four-week months, combined with separate quota evidence, and transformed into real unit prices and charts. Derived plan estimates and adoption decisions are this project's work, not upstream endorsements. Other upstream figures were not necessarily adopted.

## 《财经》 / Caijing

- Article: 《Token经济，中国账本｜〈财经〉封面》
- Authors and date recorded in the project's evidence: 吴俊宇、周源; 2026-08-17.
- [Archived source URL on NetEase](https://www.163.com/dy/article/L4ILFQL60519DDOA.html)
- Used for: comparison of saturated subscription usage, corroboration of the ChatGPT/Codex estimate, and the Alibaba flagship-model cost estimate. The Alibaba plan tier is an assumption documented in the adoption script, not a confirmed claim of the article.
- Reference record: `data/research/caijing-2026-08.json`. Its historical statements may differ from current adoption decisions.
- No open-content license has been verified. Article text, illustrations and other protected material are not covered by this project's MIT license. Attribution does not itself grant republication permission. The article URL could not be retrieved during the 2026-09-06 license check; its bibliographic details above come from the existing evidence record.

## Lobe Icons / Simple Icons

- [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons), MIT, Copyright (c) 2023 LobeHub. Used for most provider SVG marks in `web/src/assets/provider-logos/`.
- [Simple Icons](https://github.com/simple-icons/simple-icons), CC0. Used for the Xiaomi mark.
- Command Code uses the complete official avatar (dark plate + rounded frame + ⌘), not a cropped command-only extraction.
- StepFun five-square mark follows the icon in [stepfun.com](https://www.stepfun.com/assets/logo-B0FsyLQP.svg); the lime–cyan gradient follows the current public avatar.
- Compact reconstructions (Zhipu Z, OpenCode window) are this project's 22px traces from official rasters, not brand kits.
- Brand logos remain trademarks of their owners and are used only to identify the corresponding model developer.

## Leaderboards and other evidence

- [Code Arena](https://arena.ai/leaderboard/code) and [Agent Arena](https://arena.ai/leaderboard/agent): separate score snapshots.
- [Artificial Analysis Intelligence Index](https://artificialanalysis.ai/leaderboards/models) and [Coding Agent Index](https://artificialanalysis.ai/agents/coding-agents): separate score snapshots; coding-agent configuration names are retained.
- Official pricing and quota documents, community reports and aggregate local usage measurements: individual sources and adoption rationale are recorded in the data and adoption script.

## API list prices (the API cost column)

Rates re-checked 2026-09-09 and archived in [`data/research/list-prices-round2-2026-09-09.json`](data/research/list-prices-round2-2026-09-09.json), which records the tier, confidence and URL for every model.

First-party pricing pages: [OpenAI](https://developers.openai.com/api/docs/pricing) · [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) · [xAI](https://docs.x.ai/developers/models) · [Kimi](https://platform.kimi.ai/) · [Z.ai / Zhipu](https://docs.z.ai/guides/overview/pricing) · [MiniMax](https://platform.minimax.io/docs/guides/pricing-paygo) · [Alibaba Cloud Model Studio](https://www.alibabacloud.com/help/en/model-studio/model-pricing) · [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/) · [Google Gemini](https://ai.google.dev/gemini-api/docs/pricing) · [Cursor](https://cursor.com/docs/models/cursor-composer-2-5) · [Tencent Hunyuan](https://hy.tencent.ai/research/hy4-preview).

Where a model has no first-party rate card, a named third-party rate is recorded and marked as such, never presented as official: [OpenRouter](https://openrouter.ai/) (MiMo V2.5, LongCat 2.0, Nemotron 3 Ultra), [pricepertoken](https://pricepertoken.com/pricing-page/provider/stepfun-ai) (Step 3.5/3.7 Flash), [Layer3Labs](https://www.layer3labs.io/guides/muse-spark-1-3-pricing) (Muse Spark 1.2 tiers), [Tencent Cloud TokenHub](https://www.tencentcloud.com/techpedia/145748?lang=en) (Hy3 blended cross-check only). [AI Pricing Guru](https://www.aipricing.guru/pricing/) was used only to find candidate rates for models missing a first-party page; where it disagreed with a vendor page the vendor page was adopted, and each disagreement is listed in the archive's `crossChecks` block.

These pages are cited for provenance. Their rate tables remain the property of the respective providers and are not covered by this project's MIT license.

Source links are attribution and provenance, not a claim that third-party datasets are MIT-licensed. The public edition removes the contributor's account email, machine-specific directories and duplicate verbatim Caijing excerpts. Relevant numeric observations, source URLs, dates and analytical notes remain. Required public author attribution above is intentionally retained. See [PUBLICATION.md](PUBLICATION.md).
