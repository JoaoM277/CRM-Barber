<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Imagens enviadas pelo painel (logo da barbearia, foto do profissional).
 *
 * O arquivo nunca é salvo como veio: é decodificado e re-codificado em WebP
 * (GD), recortado em quadrado e reduzido. Isso tira metadados (EXIF com
 * localização), descarta qualquer conteúdo escondido e deixa a imagem leve
 * para a página de agendamento abrir rápido no celular.
 */
class Imagem
{
    /** Regra de validação para o upload. */
    public const REGRA = ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'];

    public static function salvarQuadrada(UploadedFile $arquivo, string $pasta, int $lado = 512): string
    {
        $origem = @imagecreatefromstring((string) file_get_contents($arquivo->getRealPath()));
        if (! $origem) {
            throw ValidationException::withMessages(['arquivo' => 'Não foi possível ler a imagem. Envie um JPG, PNG ou WebP.']);
        }

        $origem = self::corrigirRotacao($origem, $arquivo);

        // recorte central quadrado
        $w = imagesx($origem);
        $h = imagesy($origem);
        $corte = min($w, $h);
        $destinoLado = min($lado, $corte);
        $destino = imagecreatetruecolor($destinoLado, $destinoLado);
        imagealphablending($destino, false);
        imagesavealpha($destino, true);
        imagecopyresampled($destino, $origem, 0, 0, intdiv($w - $corte, 2), intdiv($h - $corte, 2), $destinoLado, $destinoLado, $corte, $corte);

        ob_start();
        imagewebp($destino, null, 82);
        $bytes = (string) ob_get_clean();
        imagedestroy($origem);
        imagedestroy($destino);

        $caminho = trim($pasta, '/').'/'.Str::uuid().'.webp';
        Storage::disk('public')->put($caminho, $bytes);

        return $caminho;
    }

    /**
     * Mantém a proporção (capa, galeria): reduz para caber em $maxLado no lado
     * maior. Mesmo cuidado da quadrada: re-codifica em WebP e tira o EXIF.
     */
    public static function salvarRedimensionada(UploadedFile $arquivo, string $pasta, int $maxLado = 1600): string
    {
        $origem = @imagecreatefromstring((string) file_get_contents($arquivo->getRealPath()));
        if (! $origem) {
            throw ValidationException::withMessages(['arquivo' => 'Não foi possível ler a imagem. Envie um JPG, PNG ou WebP.']);
        }
        $origem = self::corrigirRotacao($origem, $arquivo);

        $w = imagesx($origem);
        $h = imagesy($origem);
        $escala = min(1, $maxLado / max($w, $h));
        $nw = max(1, (int) round($w * $escala));
        $nh = max(1, (int) round($h * $escala));
        $destino = imagecreatetruecolor($nw, $nh);
        imagealphablending($destino, false);
        imagesavealpha($destino, true);
        imagecopyresampled($destino, $origem, 0, 0, 0, 0, $nw, $nh, $w, $h);

        ob_start();
        imagewebp($destino, null, 80);
        $bytes = (string) ob_get_clean();
        imagedestroy($origem);
        imagedestroy($destino);

        $caminho = trim($pasta, '/').'/'.Str::uuid().'.webp';
        Storage::disk('public')->put($caminho, $bytes);

        return $caminho;
    }

    /** Apaga uma imagem salva por esta classe (aceita o caminho ou a URL pública). */
    public static function apagar(?string $caminhoOuUrl): void
    {
        if (! $caminhoOuUrl) {
            return;
        }
        $base = rtrim(Storage::disk('public')->url(''), '/').'/';
        $caminho = str_starts_with($caminhoOuUrl, $base) ? substr($caminhoOuUrl, strlen($base)) : $caminhoOuUrl;

        // só apaga o que esta classe gravou: {pasta}/{barbearia}/{uuid}.webp
        if (preg_match('#^(logos|profissionais|capas|galeria|servicos)/\d+/[0-9a-f-]+\.webp$#', $caminho)) {
            Storage::disk('public')->delete($caminho);
        }
    }

    public static function url(string $caminho): string
    {
        return Storage::disk('public')->url($caminho);
    }

    /** Fotos de celular vêm "deitadas" com a rotação só no EXIF: aplica antes de recortar. */
    private static function corrigirRotacao(\GdImage $img, UploadedFile $arquivo): \GdImage
    {
        if (! function_exists('exif_read_data') || ! in_array(strtolower($arquivo->getClientOriginalExtension()), ['jpg', 'jpeg'], true)) {
            return $img;
        }
        $orientacao = @exif_read_data($arquivo->getRealPath())['Orientation'] ?? 1;
        $angulo = [3 => 180, 6 => -90, 8 => 90][$orientacao] ?? 0;

        return $angulo ? (imagerotate($img, $angulo, 0) ?: $img) : $img;
    }
}
