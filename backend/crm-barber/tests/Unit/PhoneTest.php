<?php

namespace Tests\Unit;

use App\Support\Phone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class PhoneTest extends TestCase
{
    public static function casos(): array
    {
        return [
            'celular formatado' => ['(11) 98765-4321', '5511987654321'],
            'celular só dígitos' => ['11987654321', '5511987654321'],
            'fixo 10 dígitos' => ['1133334444', '551133334444'],
            'já com DDI' => ['5511987654321', '5511987654321'],
            'DDI com +' => ['+55 11 98765-4321', '5511987654321'],
            'DDD com zero' => ['011987654321', '5511987654321'],
            'vazio' => ['', ''],
            'lixo curto' => ['123', '123'],
        ];
    }

    #[DataProvider('casos')]
    public function test_normaliza_telefone_br(string $entrada, string $esperado): void
    {
        $this->assertSame($esperado, Phone::normalizeBr($entrada));
    }
}
