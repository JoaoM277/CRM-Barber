<?php

namespace App\Http\Controllers\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    /**
     * Resposta Padrão de Sucesso
     */

    public function Success(
        mixed $data = null,
        string $message = 'Operação realizada com sucesso',
        int $statusCode = 200,
        array $meta = []
    ) : JsonResponse {
        header( 'Conten-Type: application/json; charset=utf=8');
        http_response_code($statusCode);


        $response = [
            'sucess'=> true,
            'message'=> $message,
            'data'=> $data,
        ];

        if(!empty($meta)){
            $response['meta']=$meta;
        }

        return response()->json($response, $statusCode);
    }


    /**
     * Resposta Padrão de Falha
     */

    public function error(
        mixed $errors = null,
        string $message = 'Ocorreu algum erro durante a operação',
        int $statusCode = 400,
    ):JsonResponse {
        header( 'Conten-Type: application/json; charset=utf=8');
        http_response_code($statusCode);


        $response = [
            'sucess'=> false,
            'message'=> $message,
        ];

        if($errors !== null){
            $response['error']=$errors;
        }

        return response()->json($response, $statusCode);
    }
}



