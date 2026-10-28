# Changelog

## [0.11.0](https://github.com/BrahimNJ/DevPulse/compare/v0.10.0...v0.11.0) (2026-10-28)


### Features

* **cli:** accept a --stale-only option ([810457c](https://github.com/BrahimNJ/DevPulse/commit/810457ccb289f469855e320b49fdada7b9d2f1b1)), closes [#65](https://github.com/BrahimNJ/DevPulse/issues/65)
* **cli:** list only stale branches with --stale-only ([34e4262](https://github.com/BrahimNJ/DevPulse/commit/34e4262539ceaf532d18548cd38be06ce56243e1)), closes [#65](https://github.com/BrahimNJ/DevPulse/issues/65)
* **cli:** show only stale branches with --stale-only ([39facbf](https://github.com/BrahimNJ/DevPulse/commit/39facbfa330ddd91ab28f3902257385f42c60c5e))

## [0.10.0](https://github.com/BrahimNJ/DevPulse/compare/v0.9.0...v0.10.0) (2026-10-25)


### Features

* **web:** add motion foundation, lucide icons, fonts and a new mark ([ec760be](https://github.com/BrahimNJ/DevPulse/commit/ec760be0a2292dde814a4eb4a4973e4f273cfeda)), closes [#57](https://github.com/BrahimNJ/DevPulse/issues/57)
* **web:** animate the analysis workspace and its charts ([4c61675](https://github.com/BrahimNJ/DevPulse/commit/4c616752727b0e4a82a22722c0d685e2b84f5c73)), closes [#57](https://github.com/BrahimNJ/DevPulse/issues/57)
* **web:** animate the landing page ([7133e22](https://github.com/BrahimNJ/DevPulse/commit/7133e2212ef339cc6dfbced844ae2ef9f4eb5359)), closes [#57](https://github.com/BrahimNJ/DevPulse/issues/57)
* **web:** dark visual identity with motion, icons and bundled fonts ([d93728d](https://github.com/BrahimNJ/DevPulse/commit/d93728dca5bc30598ada37f5f6e10d6fc7451cfc))
* **web:** restyle the interface as a dark night palette ([5fa627e](https://github.com/BrahimNJ/DevPulse/commit/5fa627e0aec0fca1ad06a352a42301243380147c)), closes [#57](https://github.com/BrahimNJ/DevPulse/issues/57)


### Bug Fixes

* **web:** keep the page visible without the motion engine ([0db458b](https://github.com/BrahimNJ/DevPulse/commit/0db458badcfe0157675d33b69de46fd16cb83cee)), closes [#57](https://github.com/BrahimNJ/DevPulse/issues/57)

## [0.9.0](https://github.com/BrahimNJ/DevPulse/compare/v0.8.1...v0.9.0) (2026-10-24)


### Features

* owner usage statistics behind the owner key ([9bbef61](https://github.com/BrahimNJ/DevPulse/commit/9bbef61be50e98cc509cd71688c8ff935daa30cf))
* **server:** record analyses and serve owner statistics ([283ffe7](https://github.com/BrahimNJ/DevPulse/commit/283ffe7cd1ef378b3c739d0164ff0eb0cd2613ed)), closes [#54](https://github.com/BrahimNJ/DevPulse/issues/54)
* **web:** show usage statistics on the owner page ([9a2302b](https://github.com/BrahimNJ/DevPulse/commit/9a2302b0138bc61e3f0231c0370fd7a63c085b1c)), closes [#54](https://github.com/BrahimNJ/DevPulse/issues/54)


### Bug Fixes

* **server:** bound the cost and delay of owner statistics ([3aad0f5](https://github.com/BrahimNJ/DevPulse/commit/3aad0f57924c85b1ff2d587ed96211807a6a94c6)), closes [#54](https://github.com/BrahimNJ/DevPulse/issues/54)
* **web:** keep the newest statistics view and say pseudonymous ([a778fa3](https://github.com/BrahimNJ/DevPulse/commit/a778fa39014619854cf1f49742534f3cfaa4469a)), closes [#54](https://github.com/BrahimNJ/DevPulse/issues/54)

## [0.8.1](https://github.com/BrahimNJ/DevPulse/compare/v0.8.0...v0.8.1) (2026-10-23)


### Bug Fixes

* **docker:** copy src/delivery into the image ([cae2a53](https://github.com/BrahimNJ/DevPulse/commit/cae2a534e244e01b66b022275097849fc6e8a725))
* **docker:** copy src/delivery into the image ([4d54e01](https://github.com/BrahimNJ/DevPulse/commit/4d54e01bb45493ebbdad2b9259b72144b76523d2)), closes [#51](https://github.com/BrahimNJ/DevPulse/issues/51)

## [0.8.0](https://github.com/BrahimNJ/DevPulse/compare/v0.7.0...v0.8.0) (2026-10-23)


### Features

* delivery health (DORA-style metrics) in a two-column workspace ([18ebd55](https://github.com/BrahimNJ/DevPulse/commit/18ebd55a6d4fae4e15c2683b15ee2280cf09d971))
* **delivery:** compute DORA-style delivery health ([bb15d71](https://github.com/BrahimNJ/DevPulse/commit/bb15d71441b76ced84323bf37cfeef3dce5998ab)), closes [#49](https://github.com/BrahimNJ/DevPulse/issues/49)
* **github:** read the delivery history of a repository ([5b5d87d](https://github.com/BrahimNJ/DevPulse/commit/5b5d87d866dd6ac6f8c2582e61af522288e04075)), closes [#49](https://github.com/BrahimNJ/DevPulse/issues/49)
* **server:** serve delivery reports from /api/delivery ([79da0a0](https://github.com/BrahimNJ/DevPulse/commit/79da0a0bc00b3f64412a2bcdb15c1c51eb28b872)), closes [#49](https://github.com/BrahimNJ/DevPulse/issues/49)
* **web:** format durations and fetch delivery reports ([20745b5](https://github.com/BrahimNJ/DevPulse/commit/20745b53ec2b6f516c2e8e99b694710d69f6809a)), closes [#49](https://github.com/BrahimNJ/DevPulse/issues/49)
* **web:** show delivery health in a two-column workspace ([dc06700](https://github.com/BrahimNJ/DevPulse/commit/dc06700846014ce708ff3021a19398b42e7987db)), closes [#49](https://github.com/BrahimNJ/DevPulse/issues/49)


### Bug Fixes

* **delivery:** align revert counting and weekly windows with search ([d6c85a2](https://github.com/BrahimNJ/DevPulse/commit/d6c85a22d8c669bf3c26658d0d5d57e9ac51f92c)), closes [#49](https://github.com/BrahimNJ/DevPulse/issues/49)
* **web:** complete tab keyboard support and trust only read names ([003bd0b](https://github.com/BrahimNJ/DevPulse/commit/003bd0b9fb651b53ed033cf6ef91a7fdf2963680)), closes [#49](https://github.com/BrahimNJ/DevPulse/issues/49)
* **web:** keep the header on two lines on phones ([0429c1b](https://github.com/BrahimNJ/DevPulse/commit/0429c1bd519e88fc93d7c7f938f5088de4892670))
* **web:** keep the header on two lines on phones ([5fc0506](https://github.com/BrahimNJ/DevPulse/commit/5fc050654482880e1fc2ea258d4b0c68529f2450)), closes [#46](https://github.com/BrahimNJ/DevPulse/issues/46)

## [0.7.0](https://github.com/BrahimNJ/DevPulse/compare/v0.6.0...v0.7.0) (2026-10-23)


### Features

* **web:** offer the site in French by default, with an English option ([d0ad18c](https://github.com/BrahimNJ/DevPulse/commit/d0ad18cdee16cc7531c22b31e8ae6898ff2c8d33))
* **web:** offer the site in French by default, with an English option ([5f1e4da](https://github.com/BrahimNJ/DevPulse/commit/5f1e4dae520b1e42019c559dd1ca519d74a4eb71)), closes [#43](https://github.com/BrahimNJ/DevPulse/issues/43)


### Bug Fixes

* **web:** address review of the French copy and the language switch ([7ea66e4](https://github.com/BrahimNJ/DevPulse/commit/7ea66e460d38172ac0b4728a268cca3dddf243bf)), closes [#43](https://github.com/BrahimNJ/DevPulse/issues/43)

## [0.6.0](https://github.com/BrahimNJ/DevPulse/compare/v0.5.0...v0.6.0) (2026-10-23)


### Features

* limit visitors to three analyses a day, redesign the site and add public docs ([cd0748c](https://github.com/BrahimNJ/DevPulse/commit/cd0748c09ab10f854c47f9e8395f31f151773922))
* **server:** charge visitors only for reports that are delivered ([97f24fa](https://github.com/BrahimNJ/DevPulse/commit/97f24fae0e3c54d8741c3e998afae1b495ede468)), closes [#38](https://github.com/BrahimNJ/DevPulse/issues/38)
* **server:** limit visitors to three analyses a day ([07751cf](https://github.com/BrahimNJ/DevPulse/commit/07751cf4d1434aded6aefea2c7834693f0ea270a)), closes [#38](https://github.com/BrahimNJ/DevPulse/issues/38)
* **web:** redesign the site, add public docs and the daily allowance ([7689f46](https://github.com/BrahimNJ/DevPulse/commit/7689f46281b15fa380b0f61c55567f371b967d67)), closes [#38](https://github.com/BrahimNJ/DevPulse/issues/38)


### Bug Fixes

* **server:** address review of the allowance and its store ([725c18c](https://github.com/BrahimNJ/DevPulse/commit/725c18c146a6b662da00be8fba921022e1ab9268)), closes [#38](https://github.com/BrahimNJ/DevPulse/issues/38)
* **web:** address review of the docs and owner pages ([e9c2092](https://github.com/BrahimNJ/DevPulse/commit/e9c2092d384cab9c51425040568b15eefa7e6382)), closes [#38](https://github.com/BrahimNJ/DevPulse/issues/38)


### Performance

* **server:** serve static files compressed ([6165ee0](https://github.com/BrahimNJ/DevPulse/commit/6165ee0a58e69545ef4cb889b266a493431f75f5)), closes [#38](https://github.com/BrahimNJ/DevPulse/issues/38)

## [0.5.0](https://github.com/BrahimNJ/DevPulse/compare/v0.4.0...v0.5.0) (2026-10-22)


### Features

* **github:** track the remaining API quota ([d465a39](https://github.com/BrahimNJ/DevPulse/commit/d465a39bde01931482b6e3665cda99a8a3aea3c8)), closes [#24](https://github.com/BrahimNJ/DevPulse/issues/24)
* **server:** add a per-client rate limiter ([6769bc2](https://github.com/BrahimNJ/DevPulse/commit/6769bc237ad586f043cd3d95710b1cb715accf9c)), closes [#24](https://github.com/BrahimNJ/DevPulse/issues/24)
* **server:** add a production entry point with health and logs ([84e65fb](https://github.com/BrahimNJ/DevPulse/commit/84e65fbe3a8e500dd40cb844d7a18db7d8e45b7e)), closes [#24](https://github.com/BrahimNJ/DevPulse/issues/24)
* **server:** add an expiring cache that shares concurrent loads ([1525b12](https://github.com/BrahimNJ/DevPulse/commit/1525b12d66a9a045e4de6aa7d175ca796596245d)), closes [#24](https://github.com/BrahimNJ/DevPulse/issues/24)
* **server:** protect the GitHub quota behind a cache and a reserve ([1d8404f](https://github.com/BrahimNJ/DevPulse/commit/1d8404f50d81dbb7d52ed3432f80da5633075759)), closes [#24](https://github.com/BrahimNJ/DevPulse/issues/24)
* **server:** read server settings from the environment ([1d442d1](https://github.com/BrahimNJ/DevPulse/commit/1d442d10c2147f9069a86fbe5ad18d76b33f7bae)), closes [#24](https://github.com/BrahimNJ/DevPulse/issues/24)
* **server:** serve the dashboard in production behind quota protection ([056767a](https://github.com/BrahimNJ/DevPulse/commit/056767aa164a8bb0f15323e767f9f1f6d4fa043c))


### Bug Fixes

* **infra:** address review of the first apply and the kill switch ([f31345c](https://github.com/BrahimNJ/DevPulse/commit/f31345c179e3439a5588bda7b9f1501557a40b7f)), closes [#29](https://github.com/BrahimNJ/DevPulse/issues/29)
* **infra:** make the budget kill switch handle Eventarc requests ([d7e3d33](https://github.com/BrahimNJ/DevPulse/commit/d7e3d3373eec8462cc794cde8061022d9c77d54e))
* **infra:** make the kill switch handle Eventarc HTTP requests ([f321265](https://github.com/BrahimNJ/DevPulse/commit/f321265210da33b21b8e55d0a3dcd3f3517171e2)), closes [#31](https://github.com/BrahimNJ/DevPulse/issues/31)
* **infra:** output the deterministic service URLs ([a1bd0b9](https://github.com/BrahimNJ/DevPulse/commit/a1bd0b93935d2e5c6466a127199166981fca30fe)), closes [#31](https://github.com/BrahimNJ/DevPulse/issues/31)
* **server:** refuse a public address without host names ([1ac50c7](https://github.com/BrahimNJ/DevPulse/commit/1ac50c76d206f13651660f2f909dad1ff90aaf45)), closes [#24](https://github.com/BrahimNJ/DevPulse/issues/24)

## [0.4.0](https://github.com/BrahimNJ/DevPulse/compare/v0.3.0...v0.4.0) (2026-10-22)


### Features

* **branches:** read each branch's divergence from the default branch ([febd8b5](https://github.com/BrahimNJ/DevPulse/commit/febd8b5f60134bfd260a9f32247ce7b498fc0076)), closes [#19](https://github.com/BrahimNJ/DevPulse/issues/19)
* **branches:** show how far each branch has diverged from the default branch ([d4410cc](https://github.com/BrahimNJ/DevPulse/commit/d4410cc5cd19209e95bfbb2e105a069041afc815))
* **cli:** show divergence in the branch table ([152520b](https://github.com/BrahimNJ/DevPulse/commit/152520bc3d92b86f65b185aa2733a387ffd4c80d)), closes [#19](https://github.com/BrahimNJ/DevPulse/issues/19)
* **web:** show divergence in the dashboard ([9da444c](https://github.com/BrahimNJ/DevPulse/commit/9da444cb1250a9485ee129e13ed2c4adc7422aba)), closes [#19](https://github.com/BrahimNJ/DevPulse/issues/19)

## [0.3.0](https://github.com/BrahimNJ/DevPulse/compare/v0.2.0...v0.3.0) (2026-10-20)


### Features

* **web:** add a landing page and a local dashboard ([b500bf2](https://github.com/BrahimNJ/DevPulse/commit/b500bf2c063321be3bab651b32410736dd837681))
* **web:** add a landing page that presents every feature ([0beac7f](https://github.com/BrahimNJ/DevPulse/commit/0beac7f007a20c933afcd5e9a5152e088eab38eb)), closes [#15](https://github.com/BrahimNJ/DevPulse/issues/15)
* **web:** add a local dashboard for branch statistics ([007f8a2](https://github.com/BrahimNJ/DevPulse/commit/007f8a2e86062a7d42b5c6126dd73779231ccf17)), closes [#15](https://github.com/BrahimNJ/DevPulse/issues/15)


### Bug Fixes

* **server:** reject rebound hosts and harden error handling ([e97bf31](https://github.com/BrahimNJ/DevPulse/commit/e97bf3105fafbaea76eb8b7c8819cf8f075262d8)), closes [#15](https://github.com/BrahimNJ/DevPulse/issues/15)

## [0.2.0](https://github.com/BrahimNJ/DevPulse/compare/v0.1.0...v0.2.0) (2026-10-20)


### Features

* **branches:** report branch statistics for a public repository ([de5ed8d](https://github.com/BrahimNJ/DevPulse/commit/de5ed8d080a010b14a7705995f9ce743447131a9))
* **branches:** report branch statistics for a public repository ([1fd06da](https://github.com/BrahimNJ/DevPulse/commit/1fd06da34e0be575da8900a2cb198280fe3c7cb4)), closes [#12](https://github.com/BrahimNJ/DevPulse/issues/12)


### Bug Fixes

* **github:** report network, parsing and rate limit failures clearly ([a51196d](https://github.com/BrahimNJ/DevPulse/commit/a51196d88e2858622cc3014ba80d086ea0c88990)), closes [#12](https://github.com/BrahimNJ/DevPulse/issues/12)

## 0.1.0 (2026-10-20)


### Bug Fixes

* **github:** point issue contact links to the real repository ([cc18ea2](https://github.com/BrahimNJ/DevPulse/commit/cc18ea22331f64bbacd86d2f99f8efb509b63fdd)), closes [#3](https://github.com/BrahimNJ/DevPulse/issues/3)
* **github:** replace hypothetical issue form placeholders ([5a075f7](https://github.com/BrahimNJ/DevPulse/commit/5a075f77c0854a570da89ea8d819ac4f8c893fae)), closes [#3](https://github.com/BrahimNJ/DevPulse/issues/3)
