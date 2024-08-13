# code-contextor

code-contextor is a command-line tool designed to extract context from code repositories for use with language models. It processes files in a given directory or set of paths, tokenizes the content so you know large it is in the LLMs eyes, and provides formatted output suitable for input to large language models.

## Features

- Processes multiple file types and directories
- Customizable file extension filtering
- Intelligent file filtering based on language-specific patterns and configuration files
- Token count anomaly detection
- Multiple output formats (XML, JSON, code blocks)
- Clipboard integration for automatic copying of results
- Supports various tokenizer models

## Usage

```bash
code-contextor [options] [paths...]
```

If no paths are provided, code-contextor will process the current working directory.

### Creating an Alias

To make `code-contextor` easier to use, you can create an alias. Here's how to do it in Bash or Fish shell:

#### Bash

Add the following line to your `~/.bashrc` or `~/.bash_profile`:

```bash
alias coco='bunx code-contextor'
# or if you prefer npm:
# alias coco='npx code-contextor'
```

Then, reload your shell configuration:

```bash
source ~/.bashrc  # or source ~/.bash_profile
```

#### Fish

Add the following line to your `~/.config/fish/config.fish`:

```fish
alias coco='bunx code-contextor'
# or if you prefer npm:
# alias coco='npx code-contextor'
```

Then, reload your shell configuration:

```fish
source ~/.config/fish/config.fish
```

Now you can use `coco` instead of `bunx code-contextor` or `npx code-contextor`:

```bash
coco [options] [paths...]
```
### Options

- `-V, --version`: Output the version number
- `-e, --extensions <extensions>`: File extensions to include (comma-separated)
- `-i, --ignore <patterns>`: Additional patterns to ignore (comma-separated)
- `-m, --max-tokens <number>`: Maximum number of tokens
- `-f, --format <format>`: Output format (xml, json, codeblocks) (default: "xml")
- `-t, --tokenizer <model>`: Tokenizer model to use (default: "Xenova/gpt-4")
- `--disable-language-filter`: Disable language-specific file filtering
- `--disable-config-filter`: Disable configuration file filtering
- `--disable-token-filter`: Disable token count anomaly filtering
- `--include-dot-files <patterns>`: Dot files/directories to include (comma-separated)
- `-h, --help`: Display help for command

## Example


### Basic Example
This was written by an LLM, I don't think json output is perceived well in token count or by LLMs for reasoning and idk why you would want to use the gpt3 tokenizer but Claude sonnet thought this was a good example so here it is.

```bash
code-contextor --format json --tokenizer Xenova/gpt-3 ./src
```

This command will process the `./src` directory, use the GPT-3 tokenizer, and output the results in JSON format.

### Iterating over the output

I wrote this one myself, it's more in line with how I use this tool. It's more relevant (format is left off because we use xml(default) and xml is good and we leave tokenizer blank to just use gpt-4o which is a good enough estimate even if I use llama, mistral, or claude.

```bash
coco
```

Hmm, the result is too many tokens! What a big project! Luckily the output showed us that a ton of tokens are in the `tests` directory, and the LLM doesn't actually need all the tests to understand the part I want help with. So let's ignore all files within the tests directory.

```bash
coco -i "test*"
```

Well that's much better, but we're still getting a bit too much even with the tests gone. I know my LLMs, and I know 120k tokens aren't going to make them happy after I write my convuluted prompt. I see a variety of file extensions that aren't core to the project, so I'll limit down to just extensions that I think will be important to reference.

```bash
coco -i "test*" -e py,md
```

Wonderful! Now we have 50k tokens. A bit too much if I'm paying for the API, but I'll be pasting this into the web interface that I pay a monthly subscription for, so no problemo!

### Iterative development in a project you're working on

```bash
coco src/main.zig
```

Hello LLM, I have this file, I want to do something with it. Help me.

Oh darn, the LLM didn't help me very much. It seemed to hallucinate a lot of code! Maybe it didn't have proper context of the codebase? Since I'm working on this a lot, I know exactly what files are relevant!

```bash
coco src/main.zig src/other_thing.zig src/relevant_directory
```

Here, I went ahead and included two specific files and then a full directory. I can see the token count is still low enough where I'm confident in the LLM's ability to perform well no the task I'm asking it to do. I also know that all the files I see in the output are relevant. That's great for me! I can now make changes to the relevant files based on the LLM's feedback and know that it has everything it needs to continue iterating as I continue. if I reach a point in the conversation where the context is too long because of so much back and forth, I can simply up arrow in the terminal to get the updated versions of all the files I'm working on and start a new chat tab. This is very effective.

## Output

code-contextor provides detailed information about the processed files:

1. File structure before filtering
2. Total token count before filtering
3. Detected programming language
4. Files removed by language-specific filters
5. Configuration files removed
6. Files removed due to token count anomalies (if applicable)
7. List of included files after filtering with their token counts
8. Total token count after filtering

The formatted output is automatically copied to the clipboard for easy pasting into a language model interface.

### Example Output from this repository (In the version of this commit)

```bash
$ coco .
Warning: Unable to determine file type for bun.lockb. Assuming it's not a text file.
Skipping non-text file: bun.lockb
File structure before filtering:
File structure:
├── README.md
├── app.js
├── fileFilter.js
├── fileProcessor.js
├── outputFormatter.js
├── package-lock.json
├── package.json
└── tokenizer.js

Loading tokenizer for model: Xenova/gpt-4

Total tokens before filtering: 88769

Detected language: javascript

Files removed by language-specific filter:
- package-lock.json (82596 tokens)

Configuration files removed:
- package.json (263 tokens)

No files were removed by token count anomaly filter, despite total tokens exceeding threshold.

Included files after filtering:
- README.md (1814 tokens)
- app.js (1513 tokens)
- fileFilter.js (1192 tokens)
- fileProcessor.js (1033 tokens)
- outputFormatter.js (124 tokens)
- tokenizer.js (234 tokens)

Total tokens after filtering: 5910

Formatted output has been copied to the clipboard.
```

## Supported Tokenizer Models

code-contextor supports various tokenizer models, including:

- GPT-4 / GPT-3.5-turbo / text-embedding-ada-002
- text-davinci-003 / text-davinci-002
- GPT-3
- Grok-1
- Claude
- Mistral v3 and v1
- Gemma
- Llama 3
- LLaMA / Llama 2
- Cohere Command-R
- T5
- BERT (bert-base-cased)

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. If there is a bug submit an issue and I'll fix it.
