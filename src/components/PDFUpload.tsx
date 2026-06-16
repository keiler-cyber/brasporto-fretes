'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';

interface UploadResult {
  file: File;
  extractedData: any;
}

interface PDFUploadProps {
  onUploadComplete: (results: UploadResult[]) => void;
  onError: (error: string) => void;
  cargo?: any;
  buttonLabel?: string;
}

export function PDFUpload({ onUploadComplete, onError, cargo, buttonLabel = 'Selecionar Arquivos (PDF, EML, MSG)' }: PDFUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractFromEmail = async (emailFile: File): Promise<UploadResult[]> => {
    const base64 = await convertFileToBase64(emailFile);
    const fileExt = emailFile.name.toLowerCase().slice(emailFile.name.lastIndexOf('.'));

    const response = await fetch('/api/extract-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64: base64,
        fileName: emailFile.name,
        fileType: fileExt === '.msg' ? 'msg' : 'eml',
        cargo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.debug) console.error('Error:', data.debug);
      throw new Error(data.error || 'Erro ao extrair dados do email');
    }

    // Suporte a múltiplas opções
    if (data.multiple && Array.isArray(data.items)) {
      return data.items.map((item: any) => ({ file: emailFile, extractedData: item }));
    }

    return [{ file: emailFile, extractedData: data }];
  };

  const extractPDF = async (pdfFile: File): Promise<UploadResult[]> => {
    const base64 = await convertFileToBase64(pdfFile);

    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64, fileName: pdfFile.name, cargo }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.debug) console.error('Claude raw output:', data.debug);
      throw new Error(data.error || 'Erro ao extrair PDF');
    }

    // Suporte a múltiplas opções por PDF
    if (data.multiple && Array.isArray(data.items)) {
      return data.items.map((item: any) => ({ file: pdfFile, extractedData: item }));
    }

    return [{ file: pdfFile, extractedData: data }];
  };

  const handleFileUpload = async (selectedFiles: FileList | File[]) => {
    const validExtensions = ['.pdf', '.eml', '.msg'];
    const filesArray = Array.from(selectedFiles).filter((file) => {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      return validExtensions.includes(ext);
    });

    if (filesArray.length === 0) {
      onError('Aceitos apenas arquivos: PDF, EML (email) ou MSG (Outlook)');
      return;
    }

    setFiles(filesArray);
    setExtracting(true);
    setUploading(true);

    try {
      const results: UploadResult[] = [];
      for (const file of filesArray) {
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

        let extracted: UploadResult[];
        if (ext === '.pdf') {
          extracted = await extractPDF(file);
        } else if (ext === '.eml' || ext === '.msg') {
          extracted = await extractFromEmail(file);
        } else {
          throw new Error(`Tipo de arquivo não suportado: ${ext}`);
        }

        results.push(...extracted);
      }
      onUploadComplete(results);
    } catch (error: any) {
      onError(error.message);
    } finally {
      setExtracting(false);
      setUploading(false);
      setFiles([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const selectedCount = files.length;

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-300'
          }
          ${uploading ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.eml,.msg"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        <div className="flex flex-col items-center gap-2">
          {extracting ? (
            <>
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-gray-700 font-medium">Processando arquivos...</p>
              <p className="text-sm text-gray-600">Aguarde enquanto cada arquivo é processado</p>
            </>
          ) : selectedCount > 0 ? (
            <>
              <CheckCircle className="w-8 h-8 text-green-600" />
              <p className="text-gray-700 font-medium">{selectedCount} arquivo(s) selecionado(s)</p>
              <p className="text-sm text-gray-600">Clique novamente para reenviar ou aguarde a extração</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-gray-700 font-medium">Arraste arquivos ou clique para selecionar</p>
              <p className="text-sm text-gray-600">Suporta: PDF, EML e MSG (Outlook)</p>
            </>
          )}
        </div>
      </div>

      {selectedCount > 0 && !extracting && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setFiles([]);
              setUploading(false);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
