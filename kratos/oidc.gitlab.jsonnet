// GitLab OIDC Claims Mapper
// Maps GitLab's OIDC claims to Kratos identity traits
//
// GitLab provides standard OIDC claims:
// - sub: unique user identifier
// - email: user's email address
// - email_verified: boolean
// - name: full name
// - nickname: GitLab username
// - preferred_username: GitLab username
// - picture: avatar URL
// - profile: GitLab profile URL
// - groups: array of group paths (if groups scope requested)

local claims = {
  email_verified: false,
} + std.extVar('claims');

{
  identity: {
    traits: {
      // Email from GitLab (required field)
      email: claims.email,
      
      // Name: prefer full name, fall back to nickname (GitLab username)
      name: if std.objectHas(claims, 'name') && claims.name != null && claims.name != '' 
            then claims.name 
            else if std.objectHas(claims, 'nickname') && claims.nickname != null 
            then claims.nickname
            else if std.objectHas(claims, 'preferred_username') && claims.preferred_username != null
            then claims.preferred_username
            else 'GitLab User',
      
      // Profile picture from GitLab
      picture: if std.objectHas(claims, 'picture') && claims.picture != null 
               then claims.picture 
               else '',
    },
  },
}

