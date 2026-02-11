declare module 'react-quill' {
    import { Component } from 'react';

    interface QuillModules {
        toolbar?: any;
        clipboard?: any;
        [key: string]: any;
    }

    interface ReactQuillProps {
        value?: string;
        defaultValue?: string;
        onChange?: (content: string, delta: any, source: string, editor: any) => void;
        onChangeSelection?: (range: any, source: string, editor: any) => void;
        onFocus?: (range: any, source: string, editor: any) => void;
        onBlur?: (previousRange: any, source: string, editor: any) => void;
        modules?: QuillModules;
        formats?: string[];
        theme?: string;
        readOnly?: boolean;
        placeholder?: string;
        style?: React.CSSProperties;
        className?: string;
        bounds?: string | HTMLElement;
        scrollingContainer?: string | HTMLElement;
        preserveWhitespace?: boolean;
    }

    class ReactQuill extends Component<ReactQuillProps> {
        getEditor(): any;
        focus(): void;
        blur(): void;
    }

    export default ReactQuill;
}

declare module 'react-quill/dist/quill.snow.css';
declare module 'react-quill/dist/quill.core.css';
