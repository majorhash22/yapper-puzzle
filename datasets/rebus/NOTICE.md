# Re-Bus dataset attribution

The puzzle annotations and original images in `rebus-puzzles.json` and
`public/rebus/` come from [TrishanuDas/rebus-dataset](https://huggingface.co/datasets/TrishanuDas/rebus-dataset),
revision `12233c6790bb2edc929ad7822ae428483b5c842a`.

Authors: Trishanu Das, Abhilash Nandy, Khush Bajaj, and Deepiha S.
Paper: [A Large and Diverse Multimodal Benchmark for evaluating the ability of
Vision-Language Models to understand Rebus Puzzles](https://arxiv.org/abs/2511.01340), 2025.
Original repository: <https://github.com/abhi1nandy2/Re-Bus>.

The dataset metadata declares Apache-2.0; its license text is included in
`LICENSE-2.0.txt`. The full dataset card is preserved unchanged in
`README.upstream.md`. That card also mentions personal/classroom permission and
cautions about commercial use. These statements are preserved here rather than
interpreted as a grant of rights to every original puzzle image.

The original puzzle sources, retained per entry in `rebus-puzzles.json`, are:

- <https://eslvault.com/free-printable-rebus-puzzles/>
- <https://kids.niehs.nih.gov/>
- <http://www.flashbynight.com/rebus/>

Changes made for this game: selected the 743 non-augmented rows in the pinned CSV,
downloaded the original images without modifications, assigned stable IDs from
image filenames, split pipe-separated answer variants, removed explanatory
parentheses/brackets from answers, and corrected selected annotations with
explicit answer overrides in `scripts/import-rebus.js`.

The CSV has 1,354 rows at this revision (743 original and 611 augmented), despite
the dataset card describing an older total of 1,333. Images are verified against
the SHA-256 checksums published by the Hugging Face repository.
