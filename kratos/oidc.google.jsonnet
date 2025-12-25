// Google OIDC Claims Mapper
// Maps Google's OIDC claims to Kratos identity traits
//
// Google provides standard OIDC claims:
// - sub: unique user identifier
// - email: user's email address
// - email_verified: boolean
// - name: full name
// - given_name: first name
// - family_name: last name
// - picture: avatar URL
// - locale: user's preferred language

local claims = {
  email_verified: false,
} + std.extVar('claims');

{
  identity: {
    traits: {
      // Email from Google (required field)
      email: claims.email,
      
      // Name: prefer full name, fall back to email prefix
      name: if std.objectHas(claims, 'name') && claims.name != null && claims.name != '' 
            then claims.name 
            else if std.objectHas(claims, 'given_name') && claims.given_name != null 
            then claims.given_name
            else 'Google User',
      
      // Profile picture from Google
      picture: if std.objectHas(claims, 'picture') && claims.picture != null 
               then claims.picture 
               else '',
    },
  },
}
