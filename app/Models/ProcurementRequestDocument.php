<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementRequestDocument extends Model
{
    /** Files live outside public/ so only signed-in users can open them. */
    public const DIRECTORY = 'procurement-documents';

    public const EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx'];

    public const MAX_KILOBYTES = 10240;

    public const MAX_PER_REQUEST = 20;

    protected $fillable = [
        'procurement_request_id',
        'original_name',
        'stored_name',
        'mime_type',
        'size',
        'uploaded_by',
    ];

    protected $casts = [
        'size' => 'integer',
    ];

    public static function acceptAttribute(): string
    {
        return implode(',', array_map(fn (string $ext) => '.'.$ext, self::EXTENSIONS));
    }

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function path(): string
    {
        return storage_path('app'.DIRECTORY_SEPARATOR.self::DIRECTORY.DIRECTORY_SEPARATOR.$this->stored_name);
    }

    public function extension(): string
    {
        return strtolower(pathinfo($this->stored_name, PATHINFO_EXTENSION));
    }

    public function isImage(): bool
    {
        return in_array($this->extension(), ['png', 'jpg', 'jpeg', 'webp'], true);
    }

    /** Images and PDFs open in the browser; Word/Excel files download. */
    public function opensInline(): bool
    {
        return $this->isImage() || $this->extension() === 'pdf';
    }

    public function url(): string
    {
        return '/procurement-requests/'.$this->procurement_request_id.'/documents/'.$this->id;
    }
}
