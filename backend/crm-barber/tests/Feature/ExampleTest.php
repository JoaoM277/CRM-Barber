<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A app é API-only (sem rota web em "/"); o health check responde em /up.
     */
    public function test_health_check_responde(): void
    {
        $this->get('/up')->assertOk();
    }
}
