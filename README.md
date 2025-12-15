# Markdown to Word Converter

A modern React application that converts Markdown documents to Word (.docx) format with rich formatting support.

## Features

- **Markdown Support**: Full Markdown syntax including headers, lists, code blocks, tables, and more
- **Math Expressions**: LaTeX math formula support using KaTeX
- **Mermaid Diagrams**: Render and convert Mermaid diagrams to images
- **Code Highlighting**: Syntax highlighting for code blocks
- **Multiple Export Formats**: Export to Word (.docx), PDF, and HTML
- **Real-time Preview**: Live preview of the converted document

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Markdown Processing**: React Markdown with remark plugins
- **Word Export**: docx library
- **PDF Export**: jsPDF + html2canvas
- **Styling**: CSS Modules

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd markdown2word
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## Usage

1. Enter or paste your Markdown content in the editor
2. Use the preview panel to see the formatted output
3. Click the export buttons to download in your preferred format:
   - **Word (.docx)**: Full formatting preservation
   - **PDF**: Print-ready document
   - **HTML**: Web-friendly format

## Project Structure

```
markdown2word/
├── components/          # React components
│   ├── ExportButtons.tsx    # Export functionality
│   ├── Icon.tsx             # Icon components
│   ├── LoadingContext.tsx   # Loading state management
│   └── MermaidBlock.tsx     # Mermaid diagram rendering
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
├── types.ts             # TypeScript type definitions
└── vite.config.ts       # Vite configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

## License

This project is licensed under the MIT License.
