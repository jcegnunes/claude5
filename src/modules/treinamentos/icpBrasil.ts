/**
 * Padrão de assinatura digital ICP-Brasil (DOC-ICP-15.03) para PDF: PAdES com
 * a Política de Assinatura AD-RB. Dados oficiais conferidos na Lista de
 * Políticas de Assinatura (LPA_PAdES.der) publicada em politicas.icpbrasil.gov.br.
 */

/**
 * Política em uso: PA_PAdES_AD_RB v1.3 (vigente de 23/07/2025 a 22/10/2037).
 *
 * O resumo (sigPolicyHash) colocado na assinatura é o signPolicyHash gravado
 * DENTRO do documento da política (3º campo do SignaturePolicy) — é o que o
 * Verificador de Conformidade do ITI compara. O SHA-256 do arquivo .der (valor
 * da LPA) serve só para conferir o próprio arquivo da política e é recusado
 * como resumo da política ("O resumo criptográfico da política está incorreto").
 */
export const ICP_POLICY = {
  name: 'PA_PAdES_AD_RB_v1_3',
  label: 'PAdES AD-RB v1.3 (ICP-Brasil)',
  oid: '2.16.76.1.7.1.11.1.3',
  /** signPolicyHash do documento PA_PAdES_AD_RB_v1_3.der (SHA-256) */
  hashSha256Hex: '23e4be4b9b362172e4ebb0e72b86a133ece5aad843d8651c6e38a0ba3f08fc60',
  /** SHA-256 do arquivo .der, conforme a LPA (conferência do documento) */
  fileSha256Hex: '23da544aef71f7a75dc85fa6e17a83875741e4baef41ec178258a5c86ace54dd',
  uri: 'http://politicas.icpbrasil.gov.br/PA_PAdES_AD_RB_v1_3.der',
  validUntil: '2037-10-22'
};

/**
 * Políticas PAdES AD-RB para a validação no sistema: OID -> nome, signPolicyHash
 * (o resumo esperado na assinatura) e o SHA-256 do arquivo (assinaturas geradas
 * com ele são recusadas pelo ITI). Valores lidos dos documentos oficiais.
 */
export const ICP_PADES_POLICIES: Record<string, { name: string; hash: string; fileHash: string }> = {
  '2.16.76.1.7.1.11.1': {
    name: 'AD-RB v1.0',
    hash: '501d69b4b71fc6e57323c2c74131a9c8c62409be378ba788dc288555611b9e58',
    fileHash: '739a8249a24b681e4b2280e16055d254b26b684a7ac7bc0e5aca234cc0506bbd'
  },
  '2.16.76.1.7.1.11.1.1': {
    name: 'AD-RB v1.1',
    hash: '44fc5816eb2d705d8c8f022a7f93b3fb49edfae1a7b9149ef6fab833e9bb63f8',
    fileHash: '95752d26ca974d46675ae7fb787b606a71ea941f26b59f6b6a321f97d63b9cb1'
  },
  '2.16.76.1.7.1.11.1.3': {
    name: 'AD-RB v1.3',
    hash: '23e4be4b9b362172e4ebb0e72b86a133ece5aad843d8651c6e38a0ba3f08fc60',
    fileHash: '23da544aef71f7a75dc85fa6e17a83875741e4baef41ec178258a5c86ace54dd'
  }
};

/**
 * Âncoras de confiança da política AD-RB v1.3 (certificados das ACs Raiz
 * Brasileiras v5 e v12, extraídos do próprio documento oficial da política).
 */
export const ICP_TRUST_ANCHORS_B64: Record<string, string> = {
  'Autoridade Certificadora Raiz Brasileira v5':
    'MIIGoTCCBImgAwIBAgIBATANBgkqhkiG9w0BAQ0FADCBlzELMAkGA1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxPTA7BgNV' +
    'BAsMNEluc3RpdHV0byBOYWNpb25hbCBkZSBUZWNub2xvZ2lhIGRhIEluZm9ybWFjYW8gLSBJVEkxNDAyBgNVBAMMK0F1dG9yaWRh' +
    'ZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEgdjUwHhcNMTYwMzAyMTMwMTM4WhcNMjkwMzAyMjM1OTM4WjCBlzELMAkG' +
    'A1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxPTA7BgNVBAsMNEluc3RpdHV0byBOYWNpb25hbCBkZSBUZWNub2xvZ2lhIGRh' +
    'IEluZm9ybWFjYW8gLSBJVEkxNDAyBgNVBAMMK0F1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEgdjUwggIi' +
    'MA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQD3LXgabUWsF+gUXw/6YODeF2XkqEyfk3VehdsIx+3/ERgdjCS/ouxYR0Epi2hd' +
    'oMUVJDNf3XQfjAWXJyCoTneHYAl2McMdvoqtLB2ileQlJiis0fTtYTJayee9BAIdIrCor1Lc0vozXCpDtq5nTwhjIocaZtcuFsdr' +
    'kl+nbfYxl5m7vjTkTMS6j8ffjmFzbNPDlJuV3Vy7AzapPVJrMl6UHPXCHMYMzl0KxR/47S5XGgmLYkYt8bNCHA3fg07y+Gtvgu+S' +
    'NhMPwWKIgwhYw+9vErOnavRhOimYo4M2AwNpNK0OKLI7Im5V094jFp4Ty+mlmfQH00k8nkSUEN+1TGGkhv16c2hukbx9iCfbmk7i' +
    'm2hGKjQA8eH64VPYoS2qdKbPbd3xDDHN2croYKpy2U2oQTVBSf9hC3o6fKo3zp0U3dNiw7ZgWKS9UwP31Q0gwgB1orZgLuF+LIpp' +
    'HYwxcTG/AovNWa4sTPukMiX2L+p7uIHExTZJJU4YoDacQh/mfbPIz3261He4YFmQ35sfw3eKHQSOLyiVfev/n0l/r308PijEd+d+' +
    'Hz5RmqIzS8jYXZIeJxym4mEjE1fKpeP56Ea52LlIJ8ZqsJ3xzHWu3WkAVz4hMqrX6BPMGW2IxOuEUQyIaCBg1lI6QLiPMHvo2/J7' +
    'gu4YfqRcH6i27W3HyzamEQIDAQABo4H1MIHyME4GA1UdIARHMEUwQwYFYEwBAQAwOjA4BggrBgEFBQcCARYsaHR0cDovL2FjcmFp' +
    'ei5pY3BicmFzaWwuZ292LmJyL0RQQ2FjcmFpei5wZGYwPwYDVR0fBDgwNjA0oDKgMIYuaHR0cDovL2FjcmFpei5pY3BicmFzaWwu' +
    'Z292LmJyL0xDUmFjcmFpenY1LmNybDAfBgNVHSMEGDAWgBRpqL512cTvbOcTReRhbuVo+LZAXjAdBgNVHQ4EFgQUaai+ddnE72zn' +
    'E0XkYW7laPi2QF4wDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwDQYJKoZIhvcNAQENBQADggIBABRt2/JiWapef7o/' +
    'plhR4PxymlMIp/JeZ5F0BZ1XafmYpl5g6pRokFrIRMFXLyEhlgo51I05InyCc9Td6UXjlsOASTc/LRavyjB/8NcQjlRYDh6xf7Od' +
    'P05mFcT/0+6bYRtNgsnUbr10pfsK/UzyUvQWbumGS57hCZrAZOyd9MzukiF/azAa6JfoZk2nDkEudKOY8tRyTpMmDzN5fufPSC3v' +
    '7tSJUqTqo5z7roN/FmckRzGAYyz5XulbOc5/UsAT/tk+KP/clbbqd/hhevmmdJclLr9qWZZcOgzuFU2YsgProtVu0fFNXGr6KK9f' +
    'u44pOHajmMsTXK3X7r/Pwh19kFRow5F3RQMUZC6Re0YLfXh+ypnUSCzA+uL4JPtHIGyvkbWiulkustpOKUSVwBPzvA2sQUOvqdbA' +
    'R7C8jcHYFJMuK2HZFji7pxcWWab/NKsFcJ3sluDjmhizpQaxbYTfAVXu3q8yd0su/BHHhBpteyHvYyyz0Eb9LUysR2cMtWvfPU6v' +
    'noPgYvOGO1CziyGEsgKULkCH4o2Vgl1gQuKWO4V68rFW8a/jvq28sbY+y/Ao0I5ohpnBcQOAawiFbz6yJtObajYMuztDDP8oY656' +
    'EuuJXBJhuKAJPI/7WDtgfV8ffOh/iQGQATVMtgDN0gv8bn5NdUX8UMNX1sHhU3H1UpoW',
  'Autoridade Certificadora Raiz Brasileira v12':
    'MIIGrDCCBJSgAwIBAgIJAOGP9LYdB70PMA0GCSqGSIb3DQEBDQUAMIGYMQswCQYDVQQGEwJCUjETMBEGA1UECgwKSUNQLUJyYXNp' +
    'bDE9MDsGA1UECww0SW5zdGl0dXRvIE5hY2lvbmFsIGRlIFRlY25vbG9naWEgZGEgSW5mb3JtYWNhbyAtIElUSTE1MDMGA1UEAwws' +
    'QXV0b3JpZGFkZSBDZXJ0aWZpY2Fkb3JhIFJhaXogQnJhc2lsZWlyYSB2MTIwHhcNMjQxMDIyMTQ0MTI0WhcNMzcxMDIyMTIwMDI0' +
    'WjCBmDELMAkGA1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxPTA7BgNVBAsMNEluc3RpdHV0byBOYWNpb25hbCBkZSBUZWNu' +
    'b2xvZ2lhIGRhIEluZm9ybWFjYW8gLSBJVEkxNTAzBgNVBAMMLEF1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVp' +
    'cmEgdjEyMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA5PolCsI88igf+CyoE7HeF4svWLSCE/C9XO+en7Uj6J5+zYu/' +
    'G1k2kHXMvHeOrNOK67FHxXc9n/3uhqbmJYVfm77W3Ds7dIXRhDf86x7tRIQXB9biea9NAuXcgelIw1QLwi2lF3ACdaqEfN+fdYDO' +
    '6pHCK1FCEjfIld1bNSvcUB/ah4DzPjEkJPrToYo2s9J5R6NEuzBpf0HluB+Xi/9km6OSPeJPepCCNxVsnshbOpQCCAtsoSx6zxeO' +
    'WZ8WeVHWk/RZiFSNMkaJSPdlVfRkCOdvgK5nhBpLSU1giO98HDrho3FxR3mjPQ2sSda7E7fE2IqP4xTtnS4sz5Ug9bZxcVDKX58y' +
    'savZPRj2Qh+vooxbGItRRZq81XsOhutk+p0o6HgGh4JxnmpuUdhsUQayoc/Z7AsPHpe7NTiiJfkSIXJk3mGsrHrsh66n4SIEijKy' +
    'hcykDDmSbPiLPG1IO8B9awUIYMsOeVDFei95IEK6CbKhIOqTzlcgQzQ9YVXOzqzJ1Ok53RQq5CDcX0XAH/eJiWRyWqvyyLA1N9i4' +
    '6cfRF9hK/Ws/TyrM7kjp795VmjP+hnLqA4vJtx1uNApok24TUPDB6YLA1yb9ITz8qbcwJ1KvhgWZzWu5m8tZ+3X2OjFZDuSUo5Lt' +
    'yOAiEurREE50QwFlD/pOoTNNVTZ4C6Hfr3sCAwEAAaOB9jCB8zBOBgNVHSAERzBFMEMGBWBMAQEAMDowOAYIKwYBBQUHAgEWLGh0' +
    'dHA6Ly9hY3JhaXouaWNwYnJhc2lsLmdvdi5ici9EUENhY3JhaXoucGRmMEAGA1UdHwQ5MDcwNaAzoDGGL2h0dHA6Ly9hY3JhaXou' +
    'aWNwYnJhc2lsLmdvdi5ici9MQ1JhY3JhaXp2MTIuY3JsMB8GA1UdIwQYMBaAFGrBeteSwbppTtbi88KZhIm+VXQOMB0GA1UdDgQW' +
    'BBRqwXrXksG6aU7W4vPCmYSJvlV0DjAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQ0FAAOCAgEA' +
    'FdInyigGs5T9LIzxQp9bDaAjmyIeB/LkRHlVYVedlKGIX2lTbLEKtlc/z+/dYi9vlFxhb1xuOgDFt/Cu1lHUm/U9RVtn5HimLbYt' +
    'A7TQD5FN1Jdgf24k8zwQXTa2Rv93jD3R3JmI0/mTSXEUTgyDzPwKnxxZIi4vltJYNqBhwaVH2+aA1FZpDWlx8iB8bKGGL7yw2+0b' +
    'aEuCKuxzBKaZTZwmAHbmvFys2hrTdCr/znz4yg8613WU8ebMNYDl2OjfjBCWcpcCAsSuO+A9I+DWtxdIG9Q2DaQzXXrXrbU6cdZG' +
    'MQoPogslZIYvLOnaAalhjmNz4Yq5COBJ2cXapriMmCw+TJj/j4/SKB2EDaDzfRNY+Pea0tMHCt9bXlaSnumJT6d6ZIyQYmRnjNp+' +
    'pf6Wfg9r6yiTeldfo+QnzOqn0nRwh+ltMzMfdsyZ8CiNTf60EV4+I1pPLyZn+9nC68i4OFGYzmtO91E4/YTET2HoTIGISkcMobPd' +
    'nIBW+fU8afkcIAFEJOXdl2RzFX8DuUCHtQXVmBV5DdX04SAYIqiwUtbCnUVD344sAdY8AgjpiTR8fryJ2NmkY2srZh/RHz+VG9Fx' +
    'v4hLPdajws60RXU0Nipau8hCqDpS7mHP2IeujLbL6sxQa2iPlKWyI3ZsA+W5zVbDmNx5Lnh785pEVk8hhPg='
};
