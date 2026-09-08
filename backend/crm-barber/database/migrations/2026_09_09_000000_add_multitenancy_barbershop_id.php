<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Multi-tenancy: cada barbearia é um tenant. Adiciona barbershop_id nas
     * tabelas que ainda não tinham, faz backfill para a 1ª barbearia existente
     * e troca os UNIQUE globais por UNIQUE compostos (por barbearia).
     */
    public function up(): void
    {
        $defaultId = DB::table('barbershops')->min('id');

        // ------------------------------------------------------------------
        // 1. services
        // ------------------------------------------------------------------
        Schema::table('services', function (Blueprint $table) {
            $table->foreignId('barbershop_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
        if ($defaultId) {
            DB::table('services')->whereNull('barbershop_id')->update(['barbershop_id' => $defaultId]);
            Schema::table('services', fn (Blueprint $t) => $t->unsignedBigInteger('barbershop_id')->nullable(false)->change());
        }

        // ------------------------------------------------------------------
        // 2. workers  (phone: unique global -> unique por barbearia)
        // ------------------------------------------------------------------
        Schema::table('workers', function (Blueprint $table) {
            $table->foreignId('barbershop_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->dropUnique('workers_phone_unique');
        });
        if ($defaultId) {
            DB::table('workers')->whereNull('barbershop_id')->update(['barbershop_id' => $defaultId]);
            Schema::table('workers', fn (Blueprint $t) => $t->unsignedBigInteger('barbershop_id')->nullable(false)->change());
        }
        Schema::table('workers', fn (Blueprint $t) => $t->unique(['barbershop_id', 'phone']));

        // ------------------------------------------------------------------
        // 3. clients  (phone/email: unique global -> unique por barbearia)
        // ------------------------------------------------------------------
        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('barbershop_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->dropUnique('clients_phone_unique');
            $table->dropUnique('clients_email_unique');
        });
        if ($defaultId) {
            DB::table('clients')->whereNull('barbershop_id')->update(['barbershop_id' => $defaultId]);
            Schema::table('clients', fn (Blueprint $t) => $t->unsignedBigInteger('barbershop_id')->nullable(false)->change());
        }
        Schema::table('clients', function (Blueprint $table) {
            $table->unique(['barbershop_id', 'phone']);
            $table->unique(['barbershop_id', 'email']);
        });

        // ------------------------------------------------------------------
        // 4. schedules
        // ------------------------------------------------------------------
        Schema::table('schedules', function (Blueprint $table) {
            $table->foreignId('barbershop_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
        if ($defaultId) {
            DB::table('schedules')->whereNull('barbershop_id')->update(['barbershop_id' => $defaultId]);
            Schema::table('schedules', fn (Blueprint $t) => $t->unsignedBigInteger('barbershop_id')->nullable(false)->change());
        }

        // ------------------------------------------------------------------
        // 5. operation_times  (day_of_week: unique global -> unique por barbearia)
        // ------------------------------------------------------------------
        Schema::table('operation_times', function (Blueprint $table) {
            $table->foreignId('barbershop_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->dropUnique('operation_times_day_of_week_unique');
        });
        if ($defaultId) {
            DB::table('operation_times')->whereNull('barbershop_id')->update(['barbershop_id' => $defaultId]);
            Schema::table('operation_times', fn (Blueprint $t) => $t->unsignedBigInteger('barbershop_id')->nullable(false)->change());
        }
        Schema::table('operation_times', fn (Blueprint $t) => $t->unique(['barbershop_id', 'day_of_week']));

        // ------------------------------------------------------------------
        // 6. avisos
        // ------------------------------------------------------------------
        Schema::table('avisos', function (Blueprint $table) {
            $table->foreignId('barbershop_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
        if ($defaultId) {
            DB::table('avisos')->whereNull('barbershop_id')->update(['barbershop_id' => $defaultId]);
            Schema::table('avisos', fn (Blueprint $t) => $t->unsignedBigInteger('barbershop_id')->nullable(false)->change());
        }

        // ------------------------------------------------------------------
        // 7. payouts
        // ------------------------------------------------------------------
        Schema::table('payouts', function (Blueprint $table) {
            $table->foreignId('barbershop_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
        if ($defaultId) {
            DB::table('payouts')->whereNull('barbershop_id')->update(['barbershop_id' => $defaultId]);
            Schema::table('payouts', fn (Blueprint $t) => $t->unsignedBigInteger('barbershop_id')->nullable(false)->change());
        }
    }

    public function down(): void
    {
        Schema::table('payouts', function (Blueprint $table) {
            $table->dropForeign(['barbershop_id']);
            $table->dropColumn('barbershop_id');
        });

        Schema::table('avisos', function (Blueprint $table) {
            $table->dropForeign(['barbershop_id']);
            $table->dropColumn('barbershop_id');
        });

        Schema::table('operation_times', function (Blueprint $table) {
            $table->dropUnique(['barbershop_id', 'day_of_week']);
            $table->dropForeign(['barbershop_id']);
            $table->dropColumn('barbershop_id');
            $table->unique('day_of_week');
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->dropForeign(['barbershop_id']);
            $table->dropColumn('barbershop_id');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropUnique(['barbershop_id', 'phone']);
            $table->dropUnique(['barbershop_id', 'email']);
            $table->dropForeign(['barbershop_id']);
            $table->dropColumn('barbershop_id');
            $table->unique('phone');
            $table->unique('email');
        });

        Schema::table('workers', function (Blueprint $table) {
            $table->dropUnique(['barbershop_id', 'phone']);
            $table->dropForeign(['barbershop_id']);
            $table->dropColumn('barbershop_id');
            $table->unique('phone');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropForeign(['barbershop_id']);
            $table->dropColumn('barbershop_id');
        });
    }
};
