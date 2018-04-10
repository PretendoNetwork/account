# account.pretendo.cc

[![Travis](https://travis-ci.org/PretendoNetwork/account.svg?branch=master)](https://travis-ci.org/PretendoNetwork/account)

<p align="left">
    <a href="https://discord.gg/rxekqVJ" target="_blank">
        <img src="https://discordapp.com/api/guilds/408718485913468928/widget.png?style=banner3">
    </a>
</p>

[![forthebadge](http://forthebadge.com/images/badges/built-with-love.svg)](http://forthebadge.com)

## Pretendo replacement for https://account.nintendo.net

# What is this?
This is the PN account server, which replaces the official NN account server account.nintendo.net

# What works
- [x] PNID (Pretendo Network ID) creation
- [x] PNID deletion
- [x] Logging in (access and refresh tokens granted)
- [x] Email validation (6 digit PIN)
- [x] Email validation (email token)
- [x] Linking existing PNID to new user on console
- [x] Mapping user username -> PID (`mapped_ids` admin endpoint)
- [x] Custom EULA
- [x] Timezone lists
- [x] Unlink PNID from user account on console
- [x] Account retrieval
- [x] NEX token granting (still in testing, currently no working NEX/PRUDP server)

# Currently implemented endpoints
- [GET] https://account.nintendo.net/v1/api/admin/mapped_ids
- [GET] https://account.nintendo.net/v1/api/content/time_zones/:REGION/:LANGUAGE
- [GET] https://account.nintendo.net/v1/api/content/agreements/:TYPE/:REGION/:VERSION (partly, need help<sup id="a1">[1](#f1)</sup>)
- [GET] https://account.nintendo.net/v1/api/devices/@current/status
- [ALL] https://account.nintendo.net/v1/api/oauth20/access_token/generate (Both `password` and `refresh_token` grant types)
- [POST] https://account.nintendo.net/v1/api/people (PARTLY! NEED HELP!<sup id="a3">[3](#f3)</sup>)
- [GET] https://account.nintendo.net/v1/api/people/:USERNAME
- [GET] https://account.nintendo.net/v1/api/people/@me/profile
- [PUT] https://account.nintendo.net/v1/api/people/@me/miis/@primary
- [GET] https://account.nintendo.net/v1/api/people/@me/devices/owner
- [POST] https://account.nintendo.net/v1/api/people/@me/devices
- [GET] https://account.nintendo.net/v1/api/people/@me/devices
- [PUT] https://account.nintendo.net/v1/api/people/@me/devices/@current/inactivate
- [POST] https://account.nintendo.net/v1/api/people/@me/deletion
- [GET] https://account.nintendo.net/v1/api/provider/service_token/@me
- [GET] https://account.nintendo.net/v1/api/provider/nex_token/@me (partly, still in testing)
- [PUT] https://account.nintendo.net/v1/api/support/email_confirmation/:USERPID/:CONFIRMCODE
- [POST] https://account.nintendo.net/v1/api/support/validate/email
- [GET] https://id.nintendo.net/account/email-confirmation

# Currently implemented nex servers
None


### Footnotes

<b id="f1">1</b> I do not know what other `TYPE`'s there are. I currently only know of one, `Nintendo-Network-EULA`, I still am unsure as to when I should throw error `1102` and I lack the remaining data for the rest of the EULA agreements. [↩](#a1)

<b id="f3">2</b> There are MANY values here that Nintendo seems to generate on their servers. I have no idea what some of these values mean and where/how they are used. Because of this I am unsure how to properly generate these values, and I am using placeholder values instead! ([see here for an example of what the return for an account is ](https://github.com/RedDuckss/csms/blob/master/OFFICIAL_SCHEMA.md#grab-profile))

The entire `accounts` section at the beginning is new, and not sent by the registration request. It seems to have something to do with eShop accounts, though I don't know what exactly. I went to the eShop and it never even makes a request to that endpoint so the eShop isn't using that data, yet it's the only "account" mentioned. I am also unsure as to what `active_flag` is used for. There are also several `id` fields that seem completely pointless, like the `id` field in the `email` section and how the `mii` has it's own `id`, as do each of the different `mii_image` fields. [↩](#a3)

The EULAs need to be changed, as they are currently stock Nintendo's.
