<?php

namespace App\Actions\Shared;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadFileAction
{
    public function execute(UploadedFile $file, string $directory = 'uploads', string $disk = 'public'): array
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $filename = Str::uuid() . '.' . $extension;
        $path = $file->storeAs($directory, $filename, $disk);

        $supabaseUrl = env('SUPABASE_URL', 'https://abybrwyyhuacyrexoibi.supabase.co');
        $supabaseKey = env('SUPABASE_SERVICE_ROLE_KEY') ?: env('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFieWJyd3l5aHVhY3lyZXhvaWJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY5MTY1NCwiZXhwIjoyMTAwMjY3NjU0fQ.33WnX0G0vNqT_F0j3M-E6XbX6uNCiszRbdS5Hi5OylQ');
        $bucket = env('SUPABASE_STORAGE_BUCKET', 'uploads');

        $url = Storage::url($path);

        if ($supabaseUrl && $supabaseKey && $bucket) {
            try {
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $supabaseKey,
                    'apikey' => $supabaseKey,
                    'x-upsert' => 'true',
                ])->withBody(file_get_contents($file->getRealPath()), $file->getMimeType())
                  ->post("{$supabaseUrl}/storage/v1/object/{$bucket}/{$filename}");

                if ($response->successful()) {
                    $url = "{$supabaseUrl}/storage/v1/object/public/{$bucket}/{$filename}";
                }
            } catch (\Throwable $e) {
                logger()->error('Failed to upload to Supabase Storage in Laravel: ' . $e->getMessage());
            }
        }

        return [
            'success' => true,
            'url' => $url,
            'path' => $path,
            'filename' => $filename,
        ];
    }
}