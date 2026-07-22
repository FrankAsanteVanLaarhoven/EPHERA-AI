module github.com/FrankAsanteVanLaarhoven/boundedauth/bench

go 1.22

require (
	github.com/FrankAsanteVanLaarhoven/boundedauth v0.0.0
	github.com/FrankAsanteVanLaarhoven/boundedauth/postgres v0.0.0
	github.com/jackc/pgx/v5 v5.7.2
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/crypto v0.31.0 // indirect
	golang.org/x/sync v0.10.0 // indirect
	golang.org/x/text v0.21.0 // indirect
)

replace github.com/FrankAsanteVanLaarhoven/boundedauth => ../

replace github.com/FrankAsanteVanLaarhoven/boundedauth/postgres => ../postgres
