# Changelog

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
