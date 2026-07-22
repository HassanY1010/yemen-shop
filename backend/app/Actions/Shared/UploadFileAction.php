<?php

namespace App\Actions\Shared;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class UploadFileAction
{
    public function execute(UploadedFile $file, string $directory = 'uploads', string $disk = 'public'): array
    {
        $path = $file->store($directory, $disk);

        return [
            'success' => true,
            'url' => Storage::url($path),
            'path' => $path,
        ];
    }
}