---
license: apache-2.0
configs:
- config_name: default
  data_files:
  - split: train
    path: RebusPuzzlesFullDataset.csv
language:
- en
tags:
- arXiv:2511.01340
size_categories:
- 1K<n<10K
---

# |🔄 🚍| [Re-Bus: A Large and Diverse Multimodal Benchmark for evaluating the ability of Vision-Language Models to understand Rebus Puzzles](https://arxiv.org/abs/2511.01340)

Understanding Rebus Puzzles requires a variety of skills such as image recognition, cognitive skills, commonsense reasoning, and multi-step reasoning, making this a challenging task for current Vision-Language Models. In this paper, we present Re-Bus, a large and diverse benchmark of 1,333 English Rebus Puzzles containing different artistic styles and levels of difficulty, spread across 18 categories such as food, idioms, sports, and entertainment. We also propose REBUSDESCPROGICE, a model-agnostic framework that improves the performance of Vision-Language Models on Re-Bus by combining unstructured and structured reasoning.

### **Dataset Details**
**Re-Bus** consists of 1,333 English Rebus Puzzle images. The dataset is designed to be diverse, with puzzles spread across 18 distinct categories and featuring multiple artistic styles. Of the 1,333 puzzles, 722 are original puzzles collected from various sources, and 611 are augmented versions generated using ControlNet to increase visual complexity and difficulty by adding distracting backgrounds.

### **Dataset Description**
The **Re-Bus** dataset is a high-quality annotated benchmark designed to evaluate the complex reasoning capabilities of vision-language models. Rebus Puzzles are a form of wordplay that uses images, symbols, and letters to represent words or phrases, requiring a layered reasoning process that combines visual perception with linguistic and commonsense knowledge. The dataset is curated to challenge models on their ability to perform multi-step reasoning and understand creator intent. It is highly diverse, covering 18 categories (e.g., Idiomatic Expressions, Geographical Names, Financial Terms) and various artistic styles.

**Curated by:** Annotators who were at least in their second year of undergraduate study and enrolled in institutions where English is the primary language of instruction.
**Language(s) (NLP):** English
**License:** The paper specifies that permission for personal or classroom use is granted without fee, provided that copies are not made or distributed for profit or commercial advantage. For specific licensing details, please refer to the repository.

### **Dataset Sources**
*   **Repository:** [https://github.com/abhi1nandy2/Re-Bus](https://github.com/abhi1nandy2/Re-Bus)
*   **Paper:** [https://arxiv.org/abs/2511.01340](https://arxiv.org/abs/2511.01340)

### **Dataset Overview**
*   **controlnet-canny:** Contains 611 augmented Rebus Puzzles generated using ControlNet with Canny edge detection to add complex backgrounds.
*   **images:** Contains 722 original Rebus Puzzles collected from various online sources.
*   **RebusPuzzlesDatasetAnnotation-visprog_annot_file.csv**: A CSV file containing structured, code-based reasonings related to the puzzles.
*   **RebusPuzzleswithImageDescriptions.csv**: A CSV file containing unstructured image descriptions for each Rebus Puzzle.
*   **RebusPuzzlesFullDataset.csv**: A CSV file that includes the complete dataset, containing both the original and augmented images, with the **`is_augmented`** column indicating which ones are augmented. This contains detailed annotations for each puzzle, including metadata such as difficulty level, hints and other binary features.
*   **sample-rebus-puzzle-png**: A sample Rebus Puzzle image in PNG format.

### **Uses**
#### **Direct Use**
The Re-Bus dataset is intended for benchmarking the performance of vision-language models on complex multimodal reasoning tasks. Researchers and developers can use this dataset to evaluate models on their ability to solve Rebus Puzzles, which serves as a proxy for broader reasoning skills. It is also suitable for developing and testing novel prompting frameworks, such as the REBUSDESCPROGICE method proposed in the paper.

#### **Out-of-Scope Use**
The Re-Bus dataset is not recommended for tasks unrelated to multimodal reasoning or puzzle-solving. The dataset is provided for research purposes and may not be suitable for use in commercial applications without reviewing the specific license terms.

### **Dataset Structure**
The Re-Bus dataset contains 1,333 images of Rebus Puzzles. Each puzzle is accompanied by its ground-truth answer and a rich set of meticulously annotated metadata. This metadata includes features related to the solving process, such as puzzle difficulty (Easy/Hard), a hint, and the number of reasoning steps required. It also includes binary features indicating the importance of various attributes like color, position, orientation, and size of objects or text in solving the puzzle.

### **Dataset Creation**
#### **Curation Rationale**
The Re-Bus dataset was created to address the lack of challenging benchmarks for evaluating the deep reasoning capabilities of modern VLMs. While models have excelled at tasks like VQA, solving Rebus Puzzles requires a more profound integration of vision, language, and commonsense knowledge. This dataset aims to push the boundaries of multimodal AI by providing a diverse and difficult testbed for these advanced skills.

#### **Source Data**
##### **Data Collection and Processing**
The initial set of 722 Rebus Puzzles was collected from three different online sources. Duplicate images were manually removed, and all answers were verified and corrected where necessary. To increase the dataset's difficulty and diversity, these images were then modified using ControlNet, which added complex and distracting backgrounds while preserving the core puzzle content. This process generated an additional 611 challenging puzzles, bringing the total to 1,333.

##### **Who are the source data producers?**
The original puzzles were scraped from publicly available online sources: eslvault.com, kids.niehs.nih.gov, and flashbynight.com.

#### **Annotation process**
The annotation process was carried out in three main stages:
1.  **Collection:** Rebus Puzzles and their answers were scraped from three different websites. Duplicates were removed and answers were manually verified.
2.  **Metadata Annotation:** Four qualified annotators annotated each puzzle with a rich set of metadata, including hints, difficulty, reasoning steps, and the importance of various visual attributes.
3.  **Augmentation:** ControlNet was used to modify the collected puzzles by adding distracting backgrounds, thereby increasing their difficulty. These augmented images were then filtered by an annotator to ensure they remained solvable and meaningful.

#### **Who are the annotators?**
The Re-Bus dataset was curated by four annotators, all of whom were at least undergraduate sophomores enrolled in English-medium institutions.

### **Personal and Sensitive Information**
The images in the Re-Bus dataset consist of puzzles, symbols, and text and do not include any personally identifiable information.

### **Bias, Risks, and Limitations**
*   **Language and Cultural Bias:** The dataset is exclusively in English. The puzzles and their answers may contain cultural idioms and references specific to English-speaking contexts, which could pose a limitation for models not extensively trained on such data.
*   **Subjectivity of Difficulty:** The "Easy/Hard" difficulty rating is subjective and based on the annotators' judgment, which may not align perfectly with model or general human perception.
*   **Extension to other languages:** This work is limited to the English language. Future work could involve extending the dataset to other languages.

### **Citation**
**BibTeX:**
```bibtex
@article{das2025rebus,
  title={A Large and Diverse Multimodal Benchmark for evaluating the ability of Vision-Language Models to understand Rebus Puzzles},
  author={Das, Trishanu and Nandy, Abhilash and Bajaj, Khush and S, Deepiha},
  journal={arXiv preprint arXiv:2511.01340},
  year={2025}
}